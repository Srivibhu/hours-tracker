import "server-only";
import { Redis } from "@upstash/redis";
import { promises as fs } from "fs";
import path from "path";

/**
 * Tiny hash-based key/value layer.
 * - Production (Vercel): Upstash Redis via REST.
 * - Local dev without Redis env vars: a JSON file in .data/db.json.
 */
export interface Backend {
  hgetall<T>(key: string): Promise<Record<string, T>>;
  hget<T>(key: string, field: string): Promise<T | null>;
  hset<T>(key: string, field: string, value: T): Promise<void>;
  hdel(key: string, field: string): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
}

const PREFIX = "ht:";

function redisBackend(url: string, token: string): Backend {
  const r = new Redis({ url, token });
  return {
    async hgetall<T>(key: string) {
      return ((await r.hgetall<Record<string, T>>(PREFIX + key)) ?? {}) as Record<string, T>;
    },
    async hget<T>(key: string, field: string) {
      return (await r.hget<T>(PREFIX + key, field)) ?? null;
    },
    async hset<T>(key: string, field: string, value: T) {
      await r.hset(PREFIX + key, { [field]: value });
    },
    async hdel(key: string, field: string) {
      await r.hdel(PREFIX + key, field);
    },
    async get<T>(key: string) {
      return (await r.get<T>(PREFIX + key)) ?? null;
    },
    async set<T>(key: string, value: T) {
      await r.set(PREFIX + key, value);
    },
  };
}

function fileBackend(): Backend {
  const file = path.join(process.cwd(), ".data", "db.json");
  type DB = Record<string, unknown>;
  let queue: Promise<unknown> = Promise.resolve();
  const load = async (): Promise<DB> => {
    try {
      return JSON.parse(await fs.readFile(file, "utf8"));
    } catch {
      return {};
    }
  };
  const save = async (db: DB) => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(db, null, 2));
  };
  // serialize writes so concurrent requests don't clobber each other
  const tx = <R>(fn: (db: DB) => R | Promise<R>, write = false): Promise<R> => {
    const next = queue.then(async () => {
      const db = await load();
      const out = await fn(db);
      if (write) await save(db);
      return out;
    });
    queue = next.catch(() => {});
    return next;
  };
  const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  return {
    hgetall: <T>(key: string) => tx((db) => clone((db[key] as Record<string, T>) ?? {})),
    hget: <T>(key: string, field: string) =>
      tx((db) => clone(((db[key] as Record<string, T>) ?? {})[field] ?? null)),
    hset: <T>(key: string, field: string, value: T) =>
      tx((db) => {
        const h = ((db[key] as Record<string, T>) ??= {});
        h[field] = clone(value);
      }, true),
    hdel: (key: string, field: string) =>
      tx((db) => {
        const h = db[key] as Record<string, unknown> | undefined;
        if (h) delete h[field];
      }, true),
    get: <T>(key: string) => tx((db) => clone((db[key] as T) ?? null)),
    set: <T>(key: string, value: T) =>
      tx((db) => {
        db[key] = clone(value);
      }, true),
  };
}

let backend: Backend | null = null;

export function store(): Backend {
  if (backend) return backend;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    backend = redisBackend(url, token);
  } else if (process.env.VERCEL) {
    throw new Error(
      "No database configured. In Vercel, open Storage and connect Upstash for Redis to this project, then redeploy."
    );
  } else {
    backend = fileBackend();
  }
  return backend;
}
