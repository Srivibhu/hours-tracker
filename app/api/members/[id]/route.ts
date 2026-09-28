import { fail, handle, json } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { store } from "@/lib/store";
import { OWNER_ID } from "@/lib/users";
import { listCredentials } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Owner only: revoke someone's access. Their passkeys are deleted, so they're signed out immediately.
 * Their shifts and paychecks are left in the database (only they could see them anyway).
 */
export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const { uid } = await requireUser();
  if (uid !== OWNER_ID) return fail("Only the account owner can do this.", 403);
  const { id } = await ctx.params;
  if (id === OWNER_ID) return fail("You can't remove yourself.");
  for (const c of await listCredentials()) if (c.userId === id) await store().hdel("creds", c.id);
  await store().hdel("users", id);
  return json({ ok: true });
});
