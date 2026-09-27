import { verifyRegistrationResponse, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { fail, handle, json } from "@/lib/api";
import { createSession, takeChallenge } from "@/lib/session";
import { store } from "@/lib/store";
import { b64url, listCredentials, maxDevices, rp, type StoredCredential } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const challenge = await takeChallenge("reg");
  if (!challenge) return fail("Registration expired. Try again.", 400);

  // Re-check the limit in case two registrations raced.
  if ((await listCredentials()).length >= maxDevices()) return fail("Device limit reached.", 403);

  const response = (await req.json()) as RegistrationResponseJSON;
  const { rpID, origin } = await rp();

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge.ch,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Verification failed", 400);
  }
  if (!verification.verified) return fail("Verification failed", 400);

  const { credential } = verification.registrationInfo;
  const stored: StoredCredential = {
    id: credential.id,
    publicKey: b64url.encode(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports,
    name: challenge.name || "My device",
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
  };
  await store().hset("creds", stored.id, stored);
  await createSession(stored.id);
  return json({ ok: true });
});
