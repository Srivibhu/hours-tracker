import { fail, handle, json } from "@/lib/api";
import { validatePaycheck } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { userStore } from "@/lib/users";
import type { Paycheck } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const db = userStore((await requireUser()).uid);
  const paychecks = Object.values(await db.hgetall<Paycheck>("paychecks"));
  paychecks.sort((a, b) => a.payDate.localeCompare(b.payDate));
  return json({ paychecks });
});

export const POST = handle(async (req: Request) => {
  const db = userStore((await requireUser()).uid);
  const p = validatePaycheck(await req.json().catch(() => null), crypto.randomUUID());
  if (typeof p === "string") return fail(p);
  await db.hset("paychecks", p.id, p);
  return json({ paycheck: p }, 201);
});
