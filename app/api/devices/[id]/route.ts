import { fail, handle, json } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { store } from "@/lib/store";
import { OWNER_ID } from "@/lib/users";
import type { StoredCredential } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const { cid, uid } = await requireUser();
  const { id } = await ctx.params;
  if (id === cid) return fail("You can't remove the device you're signed in on. Remove it from your other device.");
  const cred = await store().hget<StoredCredential>("creds", id);
  // Only your own devices. Without this check anyone signed in could remove someone else's.
  if (!cred || (cred.userId ?? OWNER_ID) !== uid) return fail("Device not found.", 404);
  await store().hdel("creds", id);
  return json({ ok: true });
});
