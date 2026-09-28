import { fail, handle, json } from "@/lib/api";
import { validateShift } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { userStore } from "@/lib/users";
import type { Shift } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const db = userStore((await requireUser()).uid);
  const { id } = await ctx.params;
  const existing = await db.hget<Shift>("shifts", id);
  if (!existing) return fail("Shift not found.", 404);
  const shift = validateShift(await req.json().catch(() => null), id);
  if (typeof shift === "string") return fail(shift);
  await db.hset("shifts", id, shift);
  return json({ shift });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const db = userStore((await requireUser()).uid);
  const { id } = await ctx.params;
  await db.hdel("shifts", id);
  return json({ ok: true });
});
