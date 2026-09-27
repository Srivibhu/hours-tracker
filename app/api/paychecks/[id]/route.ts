import { fail, handle, json } from "@/lib/api";
import { validatePaycheck } from "@/lib/data";
import { requireDevice } from "@/lib/session";
import { store } from "@/lib/store";
import type { Paycheck } from "@/lib/types";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  await requireDevice();
  const { id } = await ctx.params;
  if (!(await store().hget<Paycheck>("paychecks", id))) return fail("Paycheck not found.", 404);
  const p = validatePaycheck(await req.json().catch(() => null), id);
  if (typeof p === "string") return fail(p);
  await store().hset("paychecks", id, p);
  return json({ paycheck: p });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  await requireDevice();
  const { id } = await ctx.params;
  await store().hdel("paychecks", id);
  return json({ ok: true });
});
