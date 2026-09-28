import "server-only";
import { createHash, randomBytes } from "crypto";
import { store, type Backend } from "./store";

/** The original single user. Their data keeps its old, un-prefixed keys so nothing needs migrating. */
export const OWNER_ID = "owner";

export type User = { id: string; name: string; createdAt: number };

export type Invite = {
  id: string; // sha256 of the code; the code itself is never stored
  userId: string | null; // null = creates a new account, otherwise adds a device to that account
  name: string; // friend's name (new-account invites)
  createdBy: string;
  createdAt: number;
  expiresAt: number;
};

const DAY = 86400_000;

/** A view of the database scoped to one user, so one person's shifts/paychecks/settings never mix with another's. */
export function userStore(uid: string): Backend {
  if (uid === OWNER_ID) return store();
  const s = store();
  const p = `u:${uid}:`;
  return {
    hgetall: (k) => s.hgetall(p + k),
    hget: (k, f) => s.hget(p + k, f),
    hset: (k, f, v) => s.hset(p + k, f, v),
    hdel: (k, f) => s.hdel(p + k, f),
    get: (k) => s.get(p + k),
    set: (k, v) => s.set(p + k, v),
  };
}

export async function getUser(uid: string): Promise<User> {
  const u = await store().hget<User>("users", uid);
  if (u) return u;
  return { id: uid, name: uid === OWNER_ID ? "Owner" : "Friend", createdAt: 0 };
}

export async function listUsers(): Promise<User[]> {
  return Object.values(await store().hgetall<User>("users"));
}

/** WebAuthn "user handle". Must be unique per account, or one person's passkey would overwrite another's. */
export function webauthnHandle(uid: string) {
  return new TextEncoder().encode(uid === OWNER_ID ? "hours-tracker-owner" : uid);
}

const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

export async function createInvite(opts: { userId: string | null; name: string; createdBy: string }) {
  const code = randomBytes(24).toString("base64url");
  const now = Date.now();
  const invite: Invite = {
    id: hashCode(code),
    userId: opts.userId,
    name: opts.name,
    createdBy: opts.createdBy,
    createdAt: now,
    expiresAt: now + (opts.userId ? 1 : 7) * DAY,
  };
  await store().hset("invites", invite.id, invite);
  return { code, invite };
}

export async function findInvite(code: string): Promise<Invite | null> {
  if (!code || code.length > 200) return null;
  return findInviteById(hashCode(code));
}

export async function findInviteById(id: string): Promise<Invite | null> {
  const inv = await store().hget<Invite>("invites", id);
  if (!inv) return null;
  if (inv.expiresAt < Date.now()) {
    await store().hdel("invites", id);
    return null;
  }
  return inv;
}

export async function listInvites(createdBy: string): Promise<Invite[]> {
  const all = Object.values(await store().hgetall<Invite>("invites"));
  const now = Date.now();
  return all.filter((i) => i.createdBy === createdBy && i.expiresAt > now).sort((a, b) => a.createdAt - b.createdAt);
}

export const deleteInvite = (id: string) => store().hdel("invites", id);
