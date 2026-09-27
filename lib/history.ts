import type { Paycheck, Shift } from "./types";

/**
 * Starter history, pulled from Sri's Google Calendar (Isenberg TSS + Digital Evidence Lab
 * events, Sep 3 – Sep 26 2026) and the 9/25/2026 UMass pay advice.
 * Imported once automatically on first load; re-importing is safe (ids are stable).
 * Fri 9/25 Isenberg shift is intentionally left out (not worked).
 */
type Seed = Omit<Shift, "id" | "updatedAt" | "breakMin" | "note"> & { note?: string; breakMin?: number };

const seedShifts: Seed[] = [
  { jobId: "isenberg", date: "2026-09-03", start: "09:00", end: "12:00", note: "Orientation (calendar time was a placeholder)" },
  { jobId: "isenberg", date: "2026-09-09", start: "11:45", end: "15:15" },
  { jobId: "isenberg", date: "2026-09-11", start: "08:00", end: "11:00" },
  { jobId: "del", date: "2026-09-15", start: "11:30", end: "12:45" },
  { jobId: "isenberg", date: "2026-09-16", start: "11:45", end: "15:15" },
  { jobId: "del", date: "2026-09-17", start: "10:15", end: "12:30" },
  { jobId: "isenberg", date: "2026-09-18", start: "08:00", end: "11:00" },
  { jobId: "isenberg", date: "2026-09-21", start: "08:00", end: "11:00" },
  { jobId: "del", date: "2026-09-22", start: "10:00", end: "13:00" },
  { jobId: "del", date: "2026-09-23", start: "09:00", end: "15:00" },
  { jobId: "del", date: "2026-09-24", start: "10:15", end: "13:45" },
];

export const HISTORY_SHIFTS: Shift[] = seedShifts.map((s) => ({
  id: `cal-${s.date}-${s.jobId}-${s.start.replace(":", "")}`,
  breakMin: 0,
  note: "",
  ...s,
  updatedAt: 0,
}));

export const HISTORY_PAYCHECKS: Paycheck[] = [
  {
    id: "pay-2026-09-11",
    payDate: "2026-09-11",
    periodStart: "2026-08-23",
    periodEnd: "2026-09-05",
    hours: 20,
    gross: 300,
    net: 300,
    note: "Estimated: 9/25 stub YTD (39.14 h, $606.24) minus that check. Correct it if your 9/11 stub differs.",
  },
  {
    id: "pay-2026-09-25",
    payDate: "2026-09-25",
    periodStart: "2026-09-06",
    periodEnd: "2026-09-19",
    hours: 19.14,
    gross: 306.24,
    net: 306.24,
    note: "Isenberg 14.64 h (1.5 + 6.82 + 6.32) · Lab 4.5 h",
  },
];
