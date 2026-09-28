import "server-only";
import { headers } from "next/headers";
import { timingSafeEqual } from "crypto";
import { store } from "./store";
import { OWNER_ID } from "./users";

export type StoredCredential = {
  id: string; // base64url credential id
  publicKey: string; // base64url
  counter: number;
  transports?: string[];
  /** Which account this passkey belongs to. Missing on older records = the original owner. */
  userId?: string;
  name: string;
  createdAt: number;
  lastUsedAt: number | null;
};

export const RP_NAME = "Hours Tracker";

export function maxDevices() {
  const n = parseInt(process.env.MAX_DEVICES || "2", 10);
  return Number.isFinite(n) && n > 0 ? n : 2;
}

/** Relying party ID + origin. Derived from the request host unless RP_ID / ORIGIN are set. */
export async function rp() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") || h.get("host") || "localhost:3000").split(",")[0].trim();
  const hostname = host.split(":")[0];
  const proto =
    h.get("x-forwarded-proto")?.split(",")[0].trim() || (hostname === "localhost" ? "http" : "https");
  return {
    rpID: process.env.RP_ID || hostname,
    origin: process.env.ORIGIN || `${proto}://${host}`,
  };
}

export async function listCredentials(): Promise<StoredCredential[]> {
  return Object.values(await store().hgetall<StoredCredential>("creds"));
}

export async function credentialsFor(uid: string): Promise<StoredCredential[]> {
  return (await listCredentials()).filter((c) => (c.userId ?? OWNER_ID) === uid);
}

export const b64url = {
  encode: (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url"),
  decode: (s: string) => new Uint8Array(Buffer.from(s, "base64url")),
};

/** Constant-time-ish comparison for the setup code. */
export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
