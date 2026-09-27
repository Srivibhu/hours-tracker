import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server";
import { fail, handle, json } from "@/lib/api";
import { createSession, takeChallenge } from "@/lib/session";
import { store } from "@/lib/store";
import { b64url, rp, type StoredCredential } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const challenge = await takeChallenge("auth");
  if (!challenge) return fail("Sign-in expired. Try again.", 400);

  const response = (await req.json()) as AuthenticationResponseJSON;
  const cred = await store().hget<StoredCredential>("creds", response.id);
  if (!cred) return fail("This device isn't registered.", 403);

  const { rpID, origin } = await rp();
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.ch,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: cred.id,
        publicKey: b64url.decode(cred.publicKey),
        counter: cred.counter,
        transports: cred.transports as never,
      },
    });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Verification failed", 400);
  }
  if (!verification.verified) return fail("Verification failed", 400);

  await store().hset("creds", cred.id, {
    ...cred,
    counter: verification.authenticationInfo.newCounter,
    lastUsedAt: Date.now(),
  });
  await createSession(cred.id);
  return json({ ok: true });
});
