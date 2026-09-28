import { fail, handle, json } from "@/lib/api";
import { validateShift } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { userStore } from "@/lib/users";
import type { Shift } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const db = userStore((await requireUser()).uid);
  const shifts = Object.values(await db.hgetall<Shift>("shifts"));
  shifts.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return json({ shifts });
});

export const POST = handle(async (req: Request) => {
  const db = userStore((await requireUser()).uid);
  const body = await req.json().catch(() => null);
  const items = Array.isArray(body) ? body : [body];
  if (items.length > 500) return fail("Too many shifts at once.");
  const saved: Shift[] = [];
  for (const item of items) {
    const shift = validateShift(item, crypto.randomUUID());
    if (typeof shift === "string") return fail(shift);
    saved.push(shift);
  }
  for (const s of saved) await db.hset("shifts", s.id, s);
  return json({ shifts: saved }, 201);
});
