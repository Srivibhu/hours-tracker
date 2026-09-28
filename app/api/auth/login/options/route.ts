import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { handle, json } from "@/lib/api";
import { setChallenge } from "@/lib/session";
import { rp } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

export const POST = handle(async () => {
  const { rpID } = await rp();
  // No allowCredentials: passkeys are discoverable, so the browser offers whichever one this person has
  // for the site. That way several people can sign in without the server listing anyone's credentials.
  const options = await generateAuthenticationOptions({ rpID, userVerification: "required" });
  await setChallenge(options.challenge, "auth");
  return json({ options });
});
