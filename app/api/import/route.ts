import { fail, handle, json } from "@/lib/api";
import { importHistory, validateShift } from "@/lib/data";
import { requireDevice } from "@/lib/session";
import { store } from "@/lib/store";
import type { Shift } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST { kind: "history" }            -> re-import the bundled calendar history (skips duplicates)
 * POST { kind: "shifts", shifts: [] } -> import parsed CSV rows (skips exact duplicates)
 */
export const POST = handle(async (req: Request) => {
  await requireDevice();
  const body = (await req.json().catch(() => ({}))) as { kind?: string; shifts?: unknown[] };
  if (body.kind === "history") return json(await importHistory());
  if (body.kind !== "shifts" || !Array.isArray(body.shifts)) return fail("Nothing to import.");
  if (body.shifts.length > 2000) return fail("Too many rows (max 2000).");

  const existing = Object.values(await store().hgetall<Shift>("shifts"));
  const taken = new Set(existing.map((s) => `${s.date}|${s.start}|${s.jobId}`));
  let added = 0;
  let skipped = 0;
  for (const row of body.shifts) {
    const s = validateShift(row, crypto.randomUUID());
    if (typeof s === "string") return fail(`Row ${added + skipped + 1}: ${s}`);
    const key = `${s.date}|${s.start}|${s.jobId}`;
    if (taken.has(key)) {
      skipped++;
      continue;
    }
    taken.add(key);
    await store().hset("shifts", s.id, s);
    added++;
  }
  return json({ shifts: added, skipped });
});
