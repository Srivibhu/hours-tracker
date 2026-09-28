import { generateRegistrationOptions } from "@simplewebauthn/server";
import { fail, handle, json } from "@/lib/api";
import { currentUser, setChallenge } from "@/lib/session";
import { getUser, findInvite, OWNER_ID, webauthnHandle } from "@/lib/users";
import { credentialsFor, maxDevices, rp, RP_NAME, safeEqual } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

/**
 * Who is allowed to add a passkey, and to which account:
 *  - already signed in            -> another device on their own account
 *  - a valid invite link/code     -> a brand-new account (friend) or a new device on an existing account
 *  - the server's SETUP_CODE      -> the owner's account (first-time setup, or recovering a device)
 */
export const POST = handle(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { code?: string; invite?: string; name?: string };
  const me = await currentUser();

  let uid: string;
  let isNew = false;
  let inviteId = "";
  let displayName: string;

  if (me) {
    uid = me.uid;
    displayName = (await getUser(uid)).name;
  } else if (body.invite) {
    const inv = await findInvite(body.invite.trim());
    if (!inv) {
      await new Promise((r) => setTimeout(r, 800)); // slow down guessing
      return fail("That invite is invalid, already used, or has expired. Ask for a new one.", 403);
    }
    inviteId = inv.id;
    if (inv.userId) {
      uid = inv.userId;
      displayName = (await getUser(uid)).name;
    } else {
      uid = crypto.randomUUID();
      isNew = true;
      displayName = inv.name || "Friend";
    }
  } else {
    const setup = process.env.SETUP_CODE;
    if (!setup) return fail("SETUP_CODE is not configured on the server.", 500);
    if (!body.code || !safeEqual(body.code, setup)) {
      await new Promise((r) => setTimeout(r, 800));
      return fail("Wrong setup code.", 403);
    }
    uid = OWNER_ID;
    displayName = "Owner";
  }

  const creds = await credentialsFor(uid);
  if (creds.length >= maxDevices()) {
    return fail(
      `Device limit reached (${maxDevices()}). Remove a device in Settings from one of your signed-in devices first.`,
      403
    );
  }

  const name = (body.name || "").trim().slice(0, 40) || "My device";
  const { rpID } = await rp();
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: displayName,
    userDisplayName: displayName,
    // Unique per account. A shared ID would make a second person's passkey replace the first one's.
    userID: webauthnHandle(uid),
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

  await setChallenge(options.challenge, "reg", { name, uid, invite: inviteId, isNew: isNew ? "1" : "", who: displayName });
  return json(options);
});
