import type { Shift } from "./types";

/** All date math is done on YYYY-MM-DD strings treated as UTC days, so time zones never shift a date. */
const DAY = 86400000;

export const toDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
export const fromDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => fromDay(toDay(s) + n * DAY);
export const dow = (s: string) => new Date(toDay(s)).getUTCDay();
export const daysBetween = (a: string, b: string) => Math.round((toDay(b) - toDay(a)) / DAY);

export function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** Worked minutes. Overnight shifts (end < start) wrap past midnight. Open shifts count up to `now`. */
export function shiftMinutes(s: Shift, now?: { date: string; time: string }): number {
  let endMin: number;
  if (s.end) {
    endMin = toMin(s.end);
    if (endMin < toMin(s.start)) endMin += 1440;
  } else if (now) {
    endMin = daysBetween(s.date, now.date) * 1440 + toMin(now.time);
  } else {
    return 0;
  }
  return Math.max(0, endMin - toMin(s.start) - (s.breakMin || 0));
}

export type Range = { start: string; end: string; label: string }; // inclusive

export function weekRange(date: string, weekStartsOn: 0 | 1 = 0): Range {
  const offset = (dow(date) - weekStartsOn + 7) % 7;
  const start = addDays(date, -offset);
  const end = addDays(start, 6);
  return { start, end, label: `${fmtShort(start)} – ${fmtShort(end)}` };
}

export function payPeriodRange(date: string, anchor: string): Range {
  const idx = Math.floor(daysBetween(anchor, date) / 14);
  const start = addDays(anchor, idx * 14);
  const end = addDays(start, 13);
  return { start, end, label: `${fmtShort(start)} – ${fmtShort(end)}` };
}

export function monthRange(date: string): Range {
  const [y, m] = date.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const end = fromDay(Date.UTC(y, m, 0));
  const label = new Date(toDay(start)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return { start, end, label };
}

export function shiftRange(kind: "week" | "period" | "month", r: Range, dir: -1 | 1, anchor: string, weekStartsOn: 0 | 1): Range {
  if (kind === "week") return weekRange(addDays(r.start, 7 * dir), weekStartsOn);
  if (kind === "period") return payPeriodRange(addDays(r.start, 14 * dir), anchor);
  const target = dir === 1 ? addDays(r.end, 1) : addDays(r.start, -1);
  return monthRange(target);
}

export const inRange = (d: string, r: Range) => d >= r.start && d <= r.end;

export function fmtShort(s: string) {
  return new Date(toDay(s)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
export function fmtDayHeader(s: string) {
  return new Date(toDay(s)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
export function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "pm" : "am";
  const hh = h % 12 || 12;
  return m === 0 ? `${hh}${ap}` : `${hh}:${String(m).padStart(2, "0")}${ap}`;
}
export function fmtHours(min: number) {
  const h = min / 60;
  return h.toFixed(2).replace(/\.?0+$/, "") || "0";
}
export function fmtHM(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
export const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
