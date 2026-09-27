import { fail, handle, json } from "@/lib/api";
import { validatePaycheck } from "@/lib/data";
import { requireDevice } from "@/lib/session";
import { store } from "@/lib/store";
import type { Paycheck } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireDevice();
  const paychecks = Object.values(await store().hgetall<Paycheck>("paychecks"));
  paychecks.sort((a, b) => a.payDate.localeCompare(b.payDate));
  return json({ paychecks });
});

export const POST = handle(async (req: Request) => {
  await requireDevice();
  const p = validatePaycheck(await req.json().catch(() => null), crypto.randomUUID());
  if (typeof p === "string") return fail(p);
  await store().hset("paychecks", p.id, p);
  return json({ paycheck: p }, 201);
});
