"use client";

import { useEffect, useMemo, useState } from "react";
import type { Job, Settings, Shift } from "@/lib/types";
import {
  addDays,
  dow,
  fmt12,
  fmtHours,
  fmtShort,
  inRange,
  money,
  monthRange,
  payPeriodRange,
  shiftMinutes,
  shiftRange,
  toDay,
  weekRange,
  type Range,
} from "@/lib/time";
import { colorFor, useDark } from "./ui";

export type View = "week" | "period" | "month";
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const dayLabel = (d: string) =>
  `${DOW[dow(d)]} ${new Date(toDay(d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
const hrs = (min: number) => (min / 60).toFixed(2);

export default function Timesheet({
  shifts,
  settings,
  now,
  focus,
  onEdit,
  onNew,
}: {
  shifts: Shift[];
  settings: Settings;
  now: { date: string; time: string };
  focus: { view: View; nonce: number } | null;
  onEdit: (s: Shift) => void;
  onNew: (date: string) => void;
  onImported?: () => void;
  setToast?: (s: string) => void;
}) {
  const dark = useDark();
  const today = now.date;
  const [view, setView] = useState<View>("period");
  const rangeFor = (v: View, d: string): Range =>
    v === "week" ? weekRange(d, settings.weekStartsOn) : v === "period" ? payPeriodRange(d, settings.payPeriodAnchor) : monthRange(d);
  const [range, setRange] = useState<Range>(() => rangeFor("period", today));

  useEffect(() => {
    if (!focus) return;
    setView(focus.view);
    setRange(rangeFor(focus.view, today));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  useEffect(() => {
    setRange((r) => rangeFor(view, inRange(today, r) ? today : r.start));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.payPeriodAnchor, settings.weekStartsOn]);

  const jobs = useMemo(() => new Map(settings.jobs.map((j) => [j.id, j])), [settings.jobs]);
  const mins = (s: Shift) => shiftMinutes(s, now);
  const inView = useMemo(
    () => shifts.filter((s) => inRange(s.date, range)).sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start)),
    [shifts, range]
  );
  const total = inView.reduce((a, s) => a + mins(s), 0);
  const pay = inView.reduce((a, s) => a + (mins(s) / 60) * (jobs.get(s.jobId)?.rate ?? 0), 0);
  const byJob = new Map<string, number>();
  for (const s of inView) byJob.set(s.jobId, (byJob.get(s.jobId) ?? 0) + mins(s));

  function switchView(v: View) {
    setView(v);
    setRange(rangeFor(v, inRange(today, range) ? today : range.start));
  }

  function exportCsv() {
    const rows = [["Date", "Job", "Start", "End", "Break (min)", "Hours", "Rate", "Pay", "Note"]];
    for (const s of [...inView].reverse()) {
      const j = jobs.get(s.jobId);
      const h = mins(s) / 60;
      rows.push([s.date, j?.name ?? "Unknown", s.start, s.end ?? "", String(s.breakMin), h.toFixed(2), String(j?.rate ?? 0), (h * (j?.rate ?? 0)).toFixed(2), s.note]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `hours_${range.start}_to_${range.end}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const weeksInView: Range[] =
    view === "week"
      ? [range]
      : view === "period"
        ? [
            { start: range.start, end: addDays(range.start, 6), label: "Week 1" },
            { start: addDays(range.start, 7), end: range.end, label: "Week 2" },
          ]
        : [];

  // group ledger rows by day
  const groups: { date: string; list: Shift[] }[] = [];
  for (const s of inView) {
    const g = groups[groups.length - 1];
    if (g && g.date === s.date) g.list.push(s);
    else groups.push({ date: s.date, list: [s] });
  }

  return (
    <section className="section card">
      <div className="ranger">
        <div className="tabs" role="tablist" aria-label="Range">
          {(["week", "period", "month"] as View[]).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => switchView(v)}>
              {v === "week" ? "Week" : v === "period" ? "Pay period" : "Month"}
            </button>
          ))}
        </div>
        <div className="stepper">
          <button className="arrow" aria-label="Previous" onClick={() => setRange(shiftRange(view, range, -1, settings.payPeriodAnchor, settings.weekStartsOn))}>
            ←
          </button>
          <span className="range-label">{range.label}</span>
          <button className="arrow" aria-label="Next" onClick={() => setRange(shiftRange(view, range, 1, settings.payPeriodAnchor, settings.weekStartsOn))}>
            →
          </button>
          {!inRange(today, range) && (
            <button className="linkbtn" style={{ marginLeft: 4 }} onClick={() => setRange(rangeFor(view, today))}>
              Today
            </button>
          )}
        </div>
        <div className="toolbar-actions">
          <button className="linkbtn" onClick={exportCsv} disabled={!inView.length}>
            Export CSV
          </button>
          <button className="btn solid" onClick={() => onNew(inRange(today, range) ? today : range.start)}>
            + New entry
          </button>
        </div>
      </div>

      <div className="range-total">
        <span className="figure">
          {fmtHours(total)}
          <small>h</small>
        </span>
        <span className="muted num">{money(pay)}</span>
        {byJob.size > 1 && (
          <span className="byjob">
            {settings.jobs
              .filter((j) => byJob.get(j.id))
              .map((j) => (
                <span key={j.id}>
                  <i className="swatch" style={{ background: colorFor(j, dark) }} />
                  {j.name} <b className="num">{fmtHours(byJob.get(j.id)!)} h</b>
                </span>
              ))}
          </span>
        )}
      </div>

      {weeksInView.map((w) => (
        <WeekGrid key={w.start} week={w} title={view === "period" ? `${w.label} · ${fmtShort(w.start)} – ${fmtShort(w.end)}` : undefined} shifts={shifts} jobs={settings.jobs} now={now} dark={dark} />
      ))}

      <div className="days" aria-label="Entries">
        {groups.length === 0 && <p className="empty">No entries in this range.</p>}
        {groups.map(({ date, list }) => (
          <div className="day" key={date}>
            <div className="day-head">
              <b>
                {dayLabel(date)}
                {date === today && <span className="today-tag">Today</span>}
              </b>
              {list.length > 1 && <span>{fmtHours(list.reduce((a, s) => a + mins(s), 0))} h</span>}
            </div>
            {list.map((s) => {
              const j = jobs.get(s.jobId);
              return (
                <button key={s.id} className={`entry ${s.end ? "" : "open"}`} onClick={() => onEdit(s)}>
                  <span className="job">
                    <i className="swatch" style={{ background: colorFor(j, dark) }} />
                    <b>{j?.name ?? "Unknown job"}</b>
                    {s.note && <em>{s.note}</em>}
                  </span>
                  <span className="span">
                    {fmt12(s.start)} – {s.end ? fmt12(s.end) : "now"}
                    {s.breakMin ? <small>{s.breakMin}m break</small> : null}
                  </span>
                  <span className="hrs">{hrs(mins(s))} h</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {groups.length > 0 && (
        <div className="days-foot">
          <span>
            Total <span className="faint small">· {inView.length} {inView.length === 1 ? "entry" : "entries"}</span>
          </span>
          <span className="num">{hrs(total)} h</span>
        </div>
      )}
    </section>
  );
}

function WeekGrid({
  week,
  title,
  shifts,
  jobs,
  now,
  dark,
}: {
  week: Range;
  title?: string;
  shifts: Shift[];
  jobs: Job[];
  now: { date: string; time: string };
  dark: boolean;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(week.start, i));
  const cell = (jobId: string | null, d: string) =>
    shifts.filter((s) => s.date === d && (jobId === null || s.jobId === jobId)).reduce((a, s) => a + shiftMinutes(s, now), 0);
  const known = new Set(jobs.map((j) => j.id));
  const inWeek = (jobId: string) => days.some((d) => cell(jobId, d) > 0);
  const rows: { id: string | null; job?: Job; name: string }[] = jobs.filter((j) => inWeek(j.id)).map((j) => ({ id: j.id, job: j, name: j.name }));
  const orphan = shifts.some((s) => inRange(s.date, week) && !known.has(s.jobId));
  const f = (m: number) => (m ? (m / 60).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1") : "");
  const totalFor = (jobId: string | null) => days.reduce((a, d) => a + cell(jobId, d), 0);

  return (
    <div className="sheet-wrap">
      <table className="sheet">
        {title && (
          <caption>
            <span className="label">{title}</span>
          </caption>
        )}
        <thead>
          <tr>
            <th scope="col">Job</th>
            {days.map((d) => (
              <th key={d} scope="col" className={d === now.date ? "today" : ""}>
                {DOW[dow(d)]}
                <small>{Number(d.slice(8))}</small>
              </th>
            ))}
            <th scope="col" className="total">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const t = totalFor(r.id);
            return (
              <tr key={r.id}>
                <th scope="row" title={r.name}>
                  <i className="swatch" style={{ background: colorFor(r.job, dark) }} />
                  {r.name}
                </th>
                {days.map((d) => {
                  const m = cell(r.id, d);
                  return (
                    <td key={d} className={d === now.date ? "today" : ""}>
                      {f(m)}
                    </td>
                  );
                })}
                <td className="total">{f(t)}</td>
              </tr>
            );
          })}
          {rows.length === 0 && !orphan && (
            <tr className="empty-row">
              <td colSpan={9}>No hours this week</td>
            </tr>
          )}
          {orphan && (
            <tr>
              <th scope="row">Other</th>
              {days.map((d) => {
                const m = shifts.filter((s) => s.date === d && !known.has(s.jobId)).reduce((a, s) => a + shiftMinutes(s, now), 0);
                return <td key={d} className={m ? "" : "zero"}>{f(m)}</td>;
              })}
              <td className="total" />
            </tr>
          )}
        </tbody>
        {rows.length + (orphan ? 1 : 0) > 1 && (
        <tfoot>
          <tr>
            <th scope="row">All jobs</th>
            {days.map((d) => (
              <td key={d} className={d === now.date ? "today" : ""}>{f(cell(null, d))}</td>
            ))}
            <td className="total">{f(totalFor(null))}</td>
          </tr>
        </tfoot>
        )}
      </table>
    </div>
  );
}
