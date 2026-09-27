import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { store } from "./store";
import type { StoredCredential } from "./webauthn";

const SESSION_COOKIE = "ht_session";
const CHALLENGE_COOKIE = "ht_challenge";
const SESSION_DAYS = 30;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short (use at least 32 random characters).");
  }
  return new TextEncoder().encode(s);
}

const secure = () => process.env.NODE_ENV === "production";

export async function createSession(credentialId: string) {
  const token = await new SignJWT({ cid: credentialId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: secure(),
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Returns the credential id of the signed-in device, or null. Also checks the device wasn't revoked. */
export async function currentDevice(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const cid = payload.cid as string;
    const cred = await store().hget<StoredCredential>("creds", cid);
    return cred ? cid : null;
  } catch {
    return null;
  }
}

export class Unauthorized extends Error {}

export async function requireDevice(): Promise<string> {
  const cid = await currentDevice();
  if (!cid) throw new Unauthorized();
  return cid;
}

/** Short-lived signed cookie carrying the WebAuthn challenge between options + verify. */
export async function setChallenge(challenge: string, kind: "reg" | "auth", extra: Record<string, string> = {}) {
  const token = await new SignJWT({ ch: challenge, kind, ...extra })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .sign(secret());
  (await cookies()).set(CHALLENGE_COOKIE, token, {
    httpOnly: true,
    secure: secure(),
    sameSite: "strict",
    path: "/api/auth",
    maxAge: 300,
  });
}

export async function takeChallenge(kind: "reg" | "auth"): Promise<Record<string, string> | null> {
  const jar = await cookies();
  const token = jar.get(CHALLENGE_COOKIE)?.value;
  jar.delete({ name: CHALLENGE_COOKIE, path: "/api/auth" });
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.kind !== kind) return null;
    return payload as unknown as Record<string, string>;
  } catch {
    return null;
  }
}
