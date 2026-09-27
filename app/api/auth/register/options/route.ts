import { generateRegistrationOptions } from "@simplewebauthn/server";
import { fail, handle, json } from "@/lib/api";
import { currentDevice, setChallenge } from "@/lib/session";
import { listCredentials, maxDevices, rp, RP_NAME, safeEqual, USER_NAME } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { code?: string; name?: string };
  const creds = await listCredentials();

  if (creds.length >= maxDevices()) {
    return fail(
      `Device limit reached (${maxDevices()}). Remove a device in Settings from one of your signed-in devices first.`,
      403
    );
  }

  const signedIn = await currentDevice();
  if (!signedIn) {
    const setup = process.env.SETUP_CODE;
    if (!setup) return fail("SETUP_CODE is not configured on the server.", 500);
    if (!body.code || !safeEqual(body.code, setup)) {
      await new Promise((r) => setTimeout(r, 800)); // slow down guessing
      return fail("Wrong setup code.", 403);
    }
  }

  const name = (body.name || "").trim().slice(0, 40) || "My device";
  const { rpID } = await rp();
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: USER_NAME,
    userDisplayName: "Hours Tracker",
    userID: new TextEncoder().encode("hours-tracker-owner"),
    attestationType: "none",
    excludeCredentials: creds.map((c) => ({ id: c.id, transports: c.transports })),
    authenticatorSelection: {
      // "platform" = the built-in authenticator (Touch ID / Face ID / Windows Hello),
      // so the key lives on this device instead of a phone-scan or USB key.
      authenticatorAttachment: "platform",
      residentKey: "required",
      userVerification: "required",
    },
  });

  await setChallenge(options.challenge, "reg", { name });
  return json(options);
});
