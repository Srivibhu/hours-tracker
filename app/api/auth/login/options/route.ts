import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { handle, json } from "@/lib/api";
import { setChallenge } from "@/lib/session";
import { listCredentials, maxDevices, rp } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

export const POST = handle(async () => {
  const creds = await listCredentials();
  const { rpID } = await rp();
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    allowCredentials: creds.map((c) => ({ id: c.id, transports: c.transports })),
  });
  await setChallenge(options.challenge, "auth");
  return json({ options, deviceCount: creds.length, maxDevices: maxDevices() });
});
