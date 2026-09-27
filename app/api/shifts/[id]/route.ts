import { fail, handle, json } from "@/lib/api";
import { validateShift } from "@/lib/data";
import { requireDevice } from "@/lib/session";
import { store } from "@/lib/store";
import type { Shift } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  await requireDevice();
  const { id } = await ctx.params;
  const existing = await store().hget<Shift>("shifts", id);
  if (!existing) return fail("Shift not found.", 404);
  const shift = validateShift(await req.json().catch(() => null), id);
  if (typeof shift === "string") return fail(shift);
  await store().hset("shifts", id, shift);
  return json({ shift });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  await requireDevice();
  const { id } = await ctx.params;
  await store().hdel("shifts", id);
  return json({ ok: true });
});
