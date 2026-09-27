import { fail, handle, json } from "@/lib/api";
import { requireDevice } from "@/lib/session";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const current = await requireDevice();
  const { id } = await ctx.params;
  if (id === current) return fail("You can't remove the device you're signed in on. Remove it from your other device.");
  await store().hdel("creds", id);
  return json({ ok: true });
});
