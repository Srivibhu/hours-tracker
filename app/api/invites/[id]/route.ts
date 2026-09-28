import { fail, handle, json } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { deleteInvite, findInviteById } from "@/lib/users";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const { uid } = await requireUser();
  const { id } = await ctx.params;
  const inv = await findInviteById(id);
  if (!inv || inv.createdBy !== uid) return fail("Invite not found.", 404);
  await deleteInvite(id);
  return json({ ok: true });
});
