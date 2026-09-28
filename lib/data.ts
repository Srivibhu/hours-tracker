import "server-only";
import { store } from "./store";
import { OWNER_ID, userStore } from "./users";
import { HISTORY_PAYCHECKS, HISTORY_SHIFTS } from "./history";
import { DEFAULT_SETTINGS, JOB_COLORS, type Paycheck, type Settings, type Shift } from "./types";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The owner keeps the original defaults; everyone else starts with one blank job to fill in. */
function defaultsFor(uid: string): Settings {
  if (uid === OWNER_ID) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    jobs: [{ id: "job1", name: "My job", rate: 15, color: JOB_COLORS[0].light }],
    weeklyLimit: 0,
  };
}

export async function getSettings(uid: string = OWNER_ID): Promise<Settings> {
  const s = await userStore(uid).get<Settings>("settings");
  const base = defaultsFor(uid);
  if (!s) return base;
  const merged = { ...base, ...s };
  // Older versions stored free-form colors; snap them onto the validated palette.
  merged.jobs = merged.jobs.map((j, i) =>
    JOB_COLORS.some((c) => c.light === j.color) ? j : { ...j, color: JOB_COLORS[i % JOB_COLORS.length].light }
  );
  return merged;
}

export function validateSettings(input: unknown): Settings | string {
  const s = input as Partial<Settings>;
  if (!s || !Array.isArray(s.jobs) || s.jobs.length === 0) return "Add at least one job.";
  const jobs: Settings["jobs"] = [];
  for (const j of s.jobs) {
    const name = String(j?.name ?? "").trim().slice(0, 40);
    if (!name) return "Every job needs a name.";
    const rate = Number(j?.rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1000) return `Invalid rate for ${name}.`;
    const color: string = JOB_COLORS.some((c) => c.light === j?.color) ? String(j.color) : JOB_COLORS[jobs.length % JOB_COLORS.length].light;
    const id = String(j?.id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || crypto.randomUUID();
    jobs.push({ id, name, rate, color });
  }
  if (!s.payPeriodAnchor || !DATE.test(s.payPeriodAnchor)) return "Pay period start must be a date.";
  const weekStartsOn = s.weekStartsOn === 1 ? 1 : 0;
  const weeklyLimit = Math.max(0, Math.min(168, Number(s.weeklyLimit) || 0));
  const payLagDays = Math.max(0, Math.min(60, Math.round(Number(s.payLagDays ?? 6))));
  return { jobs, payPeriodAnchor: s.payPeriodAnchor, weekStartsOn, weeklyLimit, payLagDays };
}

export function validateShift(input: unknown, id: string): Shift | string {
  const s = input as Partial<Shift>;
  if (!s || typeof s !== "object") return "Invalid shift.";
  if (!s.jobId || typeof s.jobId !== "string") return "Pick a job.";
  if (!s.date || !DATE.test(s.date)) return "Invalid date.";
  if (!s.start || !TIME.test(s.start)) return "Invalid start time.";
  if (s.end !== null && s.end !== undefined && !TIME.test(s.end)) return "Invalid end time.";
  const breakMin = Math.max(0, Math.min(600, Math.round(Number(s.breakMin) || 0)));
  return {
    id,
    jobId: s.jobId.slice(0, 40),
    date: s.date,
    start: s.start,
    end: s.end ?? null,
    breakMin,
    note: String(s.note ?? "").slice(0, 300),
    updatedAt: Date.now(),
  };
}

export function validatePaycheck(input: unknown, id: string): Paycheck | string {
  const p = input as Partial<Paycheck>;
  if (!p || typeof p !== "object") return "Invalid paycheck.";
  for (const k of ["payDate", "periodStart", "periodEnd"] as const) {
    if (!p[k] || !DATE.test(p[k]!)) return "Dates must be filled in.";
  }
  if (p.periodEnd! < p.periodStart!) return "Period end is before period start.";
  const num = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100;
  const hours = num(p.hours);
  if (hours < 0 || hours > 400) return "Hours look wrong.";
  return {
    id,
    payDate: p.payDate!,
    periodStart: p.periodStart!,
    periodEnd: p.periodEnd!,
    hours,
    gross: num(p.gross),
    net: num(p.net ?? p.gross),
    note: String(p.note ?? "").slice(0, 300),
  };
}

/** Load the bundled calendar history. Stable ids, so running it twice changes nothing. */
export async function importHistory(uid: string = OWNER_ID) {
  if (uid !== OWNER_ID) return { shifts: 0, paychecks: 0 }; // the bundled history is the owner's own data
  const db = userStore(uid);
  const [shifts, paychecks] = await Promise.all([db.hgetall<Shift>("shifts"), db.hgetall<Paycheck>("paychecks")]);
  const taken = new Set(Object.values(shifts).map((s) => `${s.date}|${s.start}|${s.jobId}`));
  let added = 0;
  for (const s of HISTORY_SHIFTS) {
    if (shifts[s.id] || taken.has(`${s.date}|${s.start}|${s.jobId}`)) continue;
    await db.hset("shifts", s.id, { ...s, updatedAt: Date.now() });
    added++;
  }
  let addedPay = 0;
  for (const p of HISTORY_PAYCHECKS) {
    if (paychecks[p.id]) continue;
    await db.hset("paychecks", p.id, p);
    addedPay++;
  }
  await db.set("seeded", true);
  return { shifts: added, paychecks: addedPay };
}

export async function ensureSeeded(uid: string = OWNER_ID) {
  if (uid !== OWNER_ID) return;
  if (await store().get<boolean>("seeded")) return;
  await importHistory(uid);
}
