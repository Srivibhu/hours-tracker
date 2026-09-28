import { fail, handle, json } from "@/lib/api";
import { validatePaycheck } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { userStore } from "@/lib/users";
import type { Paycheck } from "@/lib/types";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  const db = userStore((await requireUser()).uid);
  const { id } = await ctx.params;
  if (!(await db.hget<Paycheck>("paychecks", id))) return fail("Paycheck not found.", 404);
  const p = validatePaycheck(await req.json().catch(() => null), id);
  if (typeof p === "string") return fail(p);
  await db.hset("paychecks", id, p);
  return json({ paycheck: p });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const db = userStore((await requireUser()).uid);
  const { id } = await ctx.params;
  await db.hdel("paychecks", id);
  return json({ ok: true });
});
