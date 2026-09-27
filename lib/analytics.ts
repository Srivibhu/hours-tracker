import type { Job, Paycheck, Settings, Shift } from "./types";
import {
  addDays,
  daysBetween,
  dow,
  fmtShort,
  inRange,
  monthRange,
  payPeriodRange,
  shiftMinutes,
  weekRange,
  type Range,
} from "./time";

export type Now = { date: string; time: string };

export type Agg = { minutes: number; pay: number; byJob: Record<string, number>; shifts: number };

export function aggregate(shifts: Shift[], r: Range, jobs: Map<string, Job>, now: Now): Agg {
  const out: Agg = { minutes: 0, pay: 0, byJob: {}, shifts: 0 };
  for (const s of shifts) {
    if (!inRange(s.date, r)) continue;
    const m = shiftMinutes(s, now);
    out.minutes += m;
    out.pay += (m / 60) * (jobs.get(s.jobId)?.rate ?? 0);
    out.byJob[s.jobId] = (out.byJob[s.jobId] ?? 0) + m;
    out.shifts++;
  }
  return out;
}

/** Same range, cut off after `days` days (0 = only the first day). */
const truncate = (r: Range, days: number): Range => {
  const end = addDays(r.start, days);
  return { ...r, end: end < r.end ? end : r.end };
};

export type Delta = { hours: number; pct: number | null; pay: number };
export function delta(cur: Agg, prev: Agg): Delta {
  const h = (cur.minutes - prev.minutes) / 60;
  return {
    hours: h,
    pct: prev.minutes > 0 ? ((cur.minutes - prev.minutes) / prev.minutes) * 100 : null,
    pay: cur.pay - prev.pay,
  };
}

export type Tone = "up" | "down" | "flat" | "info" | "warn";
export type Insight = { id: string; figure: string; tone: Tone; text: string; detail?: string };

const h = (min: number) => `${Math.round((min / 60) * 100) / 100} h`;
const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2 });
const signedUsd = (n: number) => (n >= 0 ? "+" : "−") + usd(Math.abs(n));
const signedPct = (p: number) => (p >= 0 ? "+" : "−") + Math.abs(Math.round(p)) + "%";
const signedH = (min: number) => (min >= 0 ? "+" : "−") + h(Math.abs(min));
const toneOf = (x: number): Tone => (Math.abs(x) < 0.01 ? "flat" : x > 0 ? "up" : "down");

export type Stats = ReturnType<typeof computeStats>;

export function computeStats(shifts: Shift[], paychecks: Paycheck[], settings: Settings, today: string, now: Now) {
  const jobs = new Map(settings.jobs.map((j) => [j.id, j]));
  const agg = (r: Range) => aggregate(shifts, r, jobs, now);
  const wk = (d: string) => weekRange(d, settings.weekStartsOn);
  const pp = (d: string) => payPeriodRange(d, settings.payPeriodAnchor);

  // ---- ranges
  const thisWeek = wk(today);
  const lastWeek = wk(addDays(thisWeek.start, -7));
  const weekBefore = wk(addDays(thisWeek.start, -14));
  const elapsedWeek = daysBetween(thisWeek.start, today);

  const thisMonth = monthRange(today);
  const lastMonth = monthRange(addDays(thisMonth.start, -1));
  const dayOfMonth = daysBetween(thisMonth.start, today);

  const thisPeriod = pp(today);
  const lastPeriod = pp(addDays(thisPeriod.start, -1));
  const elapsedPeriod = daysBetween(thisPeriod.start, today);

  const a = {
    thisWeek: agg(thisWeek),
    lastWeek: agg(lastWeek),
    weekBefore: agg(weekBefore),
    lastWeekSoFar: agg(truncate(lastWeek, elapsedWeek)),
    thisMonth: agg(thisMonth),
    lastMonth: agg(lastMonth),
    lastMonthSoFar: agg(truncate(lastMonth, dayOfMonth)),
    thisPeriod: agg(thisPeriod),
    lastPeriod: agg(lastPeriod),
    lastPeriodSoFar: agg(truncate(lastPeriod, elapsedPeriod)),
  };

  // ---- weekly history (oldest -> newest), for charts & averages
  const firstDate = shifts.reduce((m, s) => (s.date < m ? s.date : m), today);
  const nWeeks = Math.min(26, Math.max(6, Math.ceil((daysBetween(wk(firstDate).start, thisWeek.start) + 7) / 7) + 1));
  const weeks = Array.from({ length: nWeeks }, (_, i) => {
    const r = wk(addDays(thisWeek.start, -7 * (nWeeks - 1 - i)));
    return { range: r, ...agg(r), current: i === nWeeks - 1 };
  });
  const completed = weeks.filter((w) => !w.current);
  const recent4 = completed.slice(-4);
  const avg4 = recent4.reduce((s, w) => s + w.minutes, 0) / Math.max(1, recent4.length);
  const avg4Pay = recent4.reduce((s, w) => s + w.pay, 0) / Math.max(1, recent4.length);

  // ---- shift-level stats (closed shifts only)
  const closed = shifts.filter((s) => s.end);
  const lengths = closed.map((s) => shiftMinutes(s));
  const avgShift = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  const longest = closed.reduce<Shift | null>((best, s) => (!best || shiftMinutes(s) > shiftMinutes(best) ? s : best), null);

  // ---- weekday distribution (all time)
  const weekday = Array.from({ length: 7 }, () => 0);
  for (const s of shifts) weekday[dow(s.date)] += shiftMinutes(s, now);

  // ---- paychecks: logged vs paid
  const sortedPay = [...paychecks].sort((x, y) => x.payDate.localeCompare(y.payDate));
  const reconciliation = sortedPay.map((p) => {
    const logged = agg({ start: p.periodStart, end: p.periodEnd, label: "" });
    const rate = p.hours > 0 ? p.gross / p.hours : 0;
    return {
      paycheck: p,
      loggedMin: logged.minutes,
      paidMin: p.hours * 60,
      diffMin: p.hours * 60 - logged.minutes, // + = paid more than logged
      diffPay: ((p.hours * 60 - logged.minutes) / 60) * rate,
    };
  });
  const year = today.slice(0, 4);
  const ytdGross = sortedPay.filter((p) => p.payDate.startsWith(year) && p.payDate <= today).reduce((s, p) => s + p.gross, 0);
  const lastPaidEnd = sortedPay.length ? sortedPay[sortedPay.length - 1].periodEnd : null;
  const unpaid = lastPaidEnd ? agg({ start: addDays(lastPaidEnd, 1), end: today, label: "" }) : null;

  // ---- next paycheck
  const nextPayDate = addDays(thisPeriod.end, settings.payLagDays);
  const lastPeriodPaid = sortedPay.some((p) => p.periodStart === lastPeriod.start);
  const lastPeriodPayDate = addDays(lastPeriod.end, settings.payLagDays);
  const upcoming =
    !lastPeriodPaid && lastPeriodPayDate >= today
      ? { date: lastPeriodPayDate, range: lastPeriod, agg: a.lastPeriod, final: true }
      : { date: nextPayDate, range: thisPeriod, agg: a.thisPeriod, final: false };

  // ---- insights
  const out: Insight[] = [];

  if (a.lastWeek.minutes || a.weekBefore.minutes) {
    const d = delta(a.lastWeek, a.weekBefore);
    out.push({
      id: "wow",
      figure: d.pct === null ? signedH(d.hours * 60) : signedPct(d.pct),
      tone: toneOf(d.hours),
      text:
        d.pct === null
          ? `Last week (${lastWeek.label}) you logged ${h(a.lastWeek.minutes)}, up from nothing the week before.`
          : `Last week (${lastWeek.label}) you worked ${h(a.lastWeek.minutes)}, ${Math.abs(Math.round(d.pct))}% ${d.hours >= 0 ? "more" : "less"} than the week before (${h(a.weekBefore.minutes)}).`,
      detail: `You made ${usd(Math.abs(d.pay))} ${d.pay >= 0 ? "more" : "less"} than the week before: ${usd(a.lastWeek.pay)} vs ${usd(a.weekBefore.pay)}.`,
    });
  }

  if (a.thisWeek.minutes || a.lastWeekSoFar.minutes) {
    const d = delta(a.thisWeek, a.lastWeekSoFar);
    out.push({
      id: "week-pace",
      figure: signedH(d.hours * 60),
      tone: toneOf(d.hours),
      text: `This week so far: ${h(a.thisWeek.minutes)}. By this point last week you had ${h(a.lastWeekSoFar.minutes)}.`,
      detail: `${signedUsd(d.pay)} compared to the same point last week.`,
    });
  }

  if (a.thisMonth.minutes || a.lastMonth.minutes) {
    const d = delta(a.thisMonth, a.lastMonthSoFar);
    const monthName = thisMonth.label.split(" ")[0];
    const lastName = lastMonth.label.split(" ")[0];
    out.push({
      id: "mom",
      figure: d.pct === null ? h(a.thisMonth.minutes) : signedPct(d.pct),
      tone: d.pct === null ? "info" : toneOf(d.hours),
      text:
        d.pct === null
          ? `${monthName}: ${h(a.thisMonth.minutes)} and ${usd(a.thisMonth.pay)} so far. Nothing logged in ${lastName} to compare with.`
          : `${monthName} so far: ${h(a.thisMonth.minutes)}, ${Math.abs(Math.round(d.pct))}% ${d.hours >= 0 ? "more" : "less"} than ${lastName} at the same point (${h(a.lastMonthSoFar.minutes)}).`,
      detail:
        d.pct === null
          ? undefined
          : `${signedUsd(d.pay)} vs ${lastName} by day ${dayOfMonth + 1}. ${lastName} total: ${h(a.lastMonth.minutes)} / ${usd(a.lastMonth.pay)}.`,
    });
  }

  out.push({
    id: "next-check",
    figure: usd(upcoming.agg.pay),
    tone: "info",
    text: `Next paycheck around ${fmtWeekday(upcoming.date)}, for ${upcoming.range.label}: ${h(upcoming.agg.minutes)} logged${upcoming.final ? "" : " so far"}.`,
    detail: upcoming.final
      ? "That pay period is closed, so this estimate should be close unless payroll rounds differently."
      : avg4 > 0
        ? `If the rest of the period goes like your recent weeks (${h(avg4)}/wk), expect about ${usd(Math.max(upcoming.agg.pay, projectPeriod(a.thisPeriod.pay, avg4Pay, elapsedPeriod)))}.`
        : undefined,
  });

  const latest = reconciliation[reconciliation.length - 1];
  if (latest) {
    const diff = latest.diffMin;
    out.push({
      id: "logged-vs-paid",
      figure: signedH(diff),
      tone: Math.abs(diff) < 15 ? "flat" : diff > 0 ? "warn" : "down",
      text:
        Math.abs(diff) < 15
          ? `Your ${fmtShort(latest.paycheck.payDate)} paycheck matches what you logged (${h(latest.paidMin)}).`
          : diff > 0
            ? `Your ${fmtShort(latest.paycheck.payDate)} paycheck paid ${h(diff)} more than you logged (${h(latest.paidMin)} paid vs ${h(latest.loggedMin)} logged). Some shifts may be missing here.`
            : `Your ${fmtShort(latest.paycheck.payDate)} paycheck paid ${h(-diff)} less than you logged (${h(latest.paidMin)} paid vs ${h(latest.loggedMin)} logged). Check your timesheet.`,
      detail: Math.abs(diff) >= 15 ? `That's about ${usd(Math.abs(latest.diffPay))}.` : undefined,
    });
  }

  if (settings.weeklyLimit > 0) {
    const limitMin = settings.weeklyLimit * 60;
    const left = limitMin - a.thisWeek.minutes;
    const over = completed.filter((w) => w.minutes > limitMin).length;
    out.push({
      id: "limit",
      figure: `${Math.round((a.thisWeek.minutes / limitMin) * 100)}%`,
      tone: left < 0 ? "down" : left < 180 ? "warn" : "info",
      text:
        left < 0
          ? `You're ${h(-left)} over your ${settings.weeklyLimit} h weekly limit this week.`
          : `${h(left)} left under your ${settings.weeklyLimit} h weekly limit this week.`,
      detail: over ? `You went over in ${over} earlier week${over > 1 ? "s" : ""}.` : undefined,
    });
  }

  const monthJobs = Object.entries(a.thisMonth.byJob).sort((x, y) => y[1] - x[1]);
  if (monthJobs.length > 1 && a.thisMonth.minutes > 0) {
    const [topId, topMin] = monthJobs[0];
    out.push({
      id: "split",
      figure: `${Math.round((topMin / a.thisMonth.minutes) * 100)}%`,
      tone: "info",
      text: `${Math.round((topMin / a.thisMonth.minutes) * 100)}% of this month's hours were at ${jobs.get(topId)?.name ?? "one job"}.`,
      detail: monthJobs.map(([id, m]) => `${jobs.get(id)?.name ?? "Unknown"} ${h(m)}`).join(" · "),
    });
  }

  if (closed.length >= 3) {
    const busiest = weekday.indexOf(Math.max(...weekday));
    out.push({
      id: "habits",
      figure: h(avgShift),
      tone: "info",
      text: `Your average shift is ${h(avgShift)}. You work the most on ${WEEKDAYS[busiest]}s.`,
      detail: longest ? `Longest shift: ${h(shiftMinutes(longest))} on ${fmtWeekday(longest.date)}.` : undefined,
    });
  }

  if (unpaid && unpaid.minutes > 0) {
    out.push({
      id: "unpaid",
      figure: usd(unpaid.pay),
      tone: "info",
      text: `${h(unpaid.minutes)} logged since your last paid period ended (${fmtShort(lastPaidEnd!)}), about ${usd(unpaid.pay)} still to be paid.`,
      detail: ytdGross ? `Gross pay so far in ${year}: ${usd(ytdGross)}.` : undefined,
    });
  }

  return {
    ranges: { thisWeek, lastWeek, thisMonth, lastMonth, thisPeriod, lastPeriod },
    agg: a,
    deltas: {
      week: delta(a.thisWeek, a.lastWeekSoFar),
      period: delta(a.thisPeriod, a.lastPeriodSoFar),
      month: delta(a.thisMonth, a.lastMonthSoFar),
    },
    weeks,
    avg4,
    weekday,
    reconciliation,
    ytdGross,
    insights: out,
  };
}

function projectPeriod(payNow: number, avgWeekPay: number, elapsedDays: number) {
  const remainingDays = 13 - elapsedDays;
  return payNow + (avgWeekPay / 7) * Math.max(0, remainingDays);
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function fmtWeekday(d: string) {
  return `${WEEKDAYS[dow(d)].slice(0, 3)} ${fmtShort(d)}`;
}
