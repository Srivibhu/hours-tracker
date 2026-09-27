"use client";

import { useState } from "react";
import type { Paycheck, Settings } from "@/lib/types";
import type { Stats } from "@/lib/analytics";
import { WEEKDAYS } from "@/lib/analytics";
import { fmtShort, money } from "@/lib/time";
import { colorFor, useDark, useWidth } from "./ui";

const H = (min: number) => Math.round((min / 60) * 100) / 100;
const niceMax = (v: number, step: number) => Math.max(step, Math.ceil(v / step) * step);

/** Bar path with a 4px rounded data-end and a square baseline. */
function barPath(x: number, y: number, w: number, h: number, round: boolean) {
  if (h <= 0) return "";
  const r = round ? Math.min(4, w / 2, h) : 0;
  return `M${x},${y + h}V${y + r}${r ? `Q${x},${y} ${x + r},${y}` : ""}H${x + w - r}${r ? `Q${x + w},${y} ${x + w},${y + r}` : ""}V${y + h}Z`;
}
function hbarPath(x: number, y: number, w: number, h: number) {
  if (w <= 0) return "";
  const r = Math.min(4, h / 2, w);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
}

export default function Insights({
  stats,
  settings,
  paychecks,
  onEditPaycheck,
  onNewPaycheck,
}: {
  stats: Stats;
  settings: Settings;
  paychecks: Paycheck[];
  onEditPaycheck: (p: Paycheck) => void;
  onNewPaycheck: () => void;
}) {
  const totalLogged = stats.weeks.reduce((a, w) => a + w.minutes, 0);
  const activeWeeks = stats.weeks.filter((w) => w.minutes > 0).length;
  const closedShiftsAvg =
    stats.insights.find((i) => i.id === "habits")?.figure ?? "—";

  return (
    <>
      <section className="section">
        <div className="section-head">
          <h2>How you&apos;re doing</h2>
          <span className="label">Updated live</span>
        </div>
        <ul className="insights">
          {stats.insights.map((i) => (
            <li key={i.id} className="insight">
              <div className={`fig ${i.tone === "up" ? "up" : i.tone === "down" ? "down" : i.tone === "warn" ? "warn" : ""}`}>
                {(i.tone === "up" || i.tone === "down") && <span className="arrow">{i.tone === "up" ? "▲" : "▼"}</span>}
                {i.tone === "warn" && <span className="arrow">!</span>}
                {i.tone === "up" || i.tone === "down" ? i.figure.replace(/^[+−]/, "") : i.figure}
              </div>
              <div>
                <p>{i.text}</p>
                {i.detail && <p>{i.detail}</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <div className="kpis">
          <div>
            <span className="label">Avg week (last 4)</span>
            <div className="figure">{H(stats.avg4)}<small>h</small></div>
          </div>
          <div>
            <span className="label">Avg shift</span>
            <div className="figure">{closedShiftsAvg.replace(" h", "")}<small>h</small></div>
          </div>
          <div>
            <span className="label">Paid this year</span>
            <div className="figure">{money(stats.ytdGross)}</div>
          </div>
          <div>
            <span className="label">Logged · {activeWeeks} wks</span>
            <div className="figure">{H(totalLogged)}<small>h</small></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Hours per week</h2>
          <span className="label">By job{settings.weeklyLimit ? ` · ${settings.weeklyLimit} h limit` : ""}</span>
        </div>
        <WeeklyChart stats={stats} settings={settings} />
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Logged vs paid</h2>
          <button className="linkbtn" onClick={onNewPaycheck}>+ Add paycheck</button>
        </div>
        {stats.reconciliation.length === 0 ? (
          <p className="empty">Add a paycheck from HR Direct to compare paid hours with what you logged.</p>
        ) : (
          <>
            <ReconChart stats={stats} />
            <div className="ledger recon" role="table" aria-label="Paychecks" style={{ marginTop: 14 }}>
              <div className="ledger-head label" role="row">
                <span>Paid</span>
                <span>Period</span>
                <span>Logged</span>
                <span>Paid</span>
                <span>Diff</span>
              </div>
              {[...stats.reconciliation].reverse().map((r) => {
                const d = H(r.diffMin);
                return (
                  <button key={r.paycheck.id} className="entry" role="row" onClick={() => onEditPaycheck(r.paycheck)} title={r.paycheck.note}>
                    <span className="when">{fmtShort(r.paycheck.payDate)}</span>
                    <span className="job">
                      <b className="mono small">{fmtShort(r.paycheck.periodStart)}–{fmtShort(r.paycheck.periodEnd)}</b>
                      <em className="hide-sm">{money(r.paycheck.gross)}</em>
                    </span>
                    <span className="t">{H(r.loggedMin).toFixed(2)}</span>
                    <span className="t">{r.paycheck.hours.toFixed(2)}</span>
                    <span className={`hrs ${Math.abs(d) < 0.25 ? "faint" : d > 0 ? "warn" : "down"}`}>
                      {d > 0 ? "+" : d < 0 ? "−" : ""}
                      {Math.abs(d).toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="section-note">
              <b>+</b> means payroll paid more hours than you logged here (a shift is probably missing). <b>−</b> means you logged hours
              that weren&apos;t paid, which is worth checking in HR Direct. Tap a row to edit it.
            </p>
          </>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>When you work</h2>
          <span className="label">All logged hours by weekday</span>
        </div>
        <WeekdayChart stats={stats} />
      </section>

      <section className="section">
        <div className="section-head">
          <h2>More ideas</h2>
          <span className="label">Not built yet</span>
        </div>
        <ul className="insights">
          {IDEAS.map(([t, d]) => (
            <li key={t} className="insight">
              <div className="fig faint">○</div>
              <div>
                <p>{t}</p>
                <p>{d}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

const IDEAS: [string, string][] = [
  ["Time-of-day heatmap", "Weekday × hour grid showing when your shifts cluster (mornings at Isenberg, midday at the lab)."],
  ["Calendar sync", "Pull planned shifts from Google Calendar and flag ones you didn't log."],
  ["Semester view", "Totals per semester and summer, with a comparison against last semester."],
  ["Goal tracking", "Set a savings or earnings goal and see how many shifts are left to reach it."],
  ["Tax-year summary", "Gross by year with W-2 numbers, handy for filing."],
];

/* ---------------- charts ---------------- */

type TipState = { x: number; y: number; content: React.ReactNode } | null;
function Tip({ tip }: { tip: TipState }) {
  if (!tip) return null;
  return (
    <div className="tip" style={{ left: tip.x, top: tip.y }}>
      {tip.content}
    </div>
  );
}

function WeeklyChart({ stats, settings }: { stats: Stats; settings: Settings }) {
  const dark = useDark();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const maxBars = width < 480 ? 8 : 14;
  const weeks = stats.weeks.slice(-maxBars);
  const height = 220;
  const m = { t: 16, r: 8, b: 26, l: 30 };
  const iw = Math.max(0, width - m.l - m.r);
  const ih = height - m.t - m.b;
  const limit = settings.weeklyLimit;
  const top = niceMax(Math.max(limit, ...weeks.map((w) => H(w.minutes))) * 1.08, 5);
  const y = (v: number) => m.t + ih - (v / top) * ih;
  const band = iw / Math.max(1, weeks.length);
  const bw = Math.min(24, band * 0.6);
  const ticks = Array.from({ length: Math.floor(top / 5) + 1 }, (_, i) => i * 5).filter((v) => v <= top);
  const jobs = settings.jobs;

  const tip: TipState =
    hover === null
      ? null
      : (() => {
          const w = weeks[hover];
          const cx = m.l + band * hover + band / 2;
          return {
            x: Math.min(Math.max(cx, 80), width - 80),
            y: y(H(w.minutes)) - 8,
            content: (
              <>
                <b>
                  Week of {fmtShort(w.range.start)}
                  {w.current ? " (so far)" : ""}
                </b>
                {jobs.map((j) => (
                  <div className="row" key={j.id}>
                    <span>
                      <i className="swatch" style={{ background: colorFor(j, dark) }} />
                      {j.name}
                    </span>
                    <span>{H(w.byJob[j.id] ?? 0)} h</span>
                  </div>
                ))}
                <div className="row" style={{ borderTop: "1px solid rgba(128,128,128,.4)", marginTop: 4, paddingTop: 4 }}>
                  <span>Total · {money(w.pay)}</span>
                  <span>{H(w.minutes)} h</span>
                </div>
              </>
            ),
          };
        })();

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Hours per week, stacked by job">
          <g className="axis">
            {ticks.map((t) => (
              <g key={t}>
                <line className={t === 0 ? "baseline" : "gridline"} x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} />
                <text x={m.l - 6} y={y(t) + 3.5} textAnchor="end">{t}</text>
              </g>
            ))}
            {weeks.map((w, i) =>
              weeks.length <= 8 || i % 2 === (weeks.length - 1) % 2 ? (
                <text key={w.range.start} x={m.l + band * i + band / 2} y={height - 8} textAnchor="middle">
                  {fmtShort(w.range.start).replace(" ", " ")}
                </text>
              ) : null
            )}
          </g>
          {limit > 0 && (
            <g>
              <line className="refline" x1={m.l} x2={width - m.r} y1={y(limit)} y2={y(limit)} />
              <text className="reftext" x={width - m.r} y={y(limit) - 5} textAnchor="end">{limit} h limit</text>
            </g>
          )}
          {weeks.map((w, i) => {
            const x = m.l + band * i + (band - bw) / 2;
            let acc = 0;
            const segs = jobs
              .map((j) => ({ j, v: H(w.byJob[j.id] ?? 0) }))
              .filter((s) => s.v > 0);
            const other = H(w.minutes) - segs.reduce((a, s) => a + s.v, 0);
            if (other > 0.01) segs.push({ j: undefined as never, v: other });
            return (
              <g key={w.range.start} opacity={w.current ? 0.55 : 1}>
                {segs.map((s, k) => {
                  const y0 = y(acc);
                  acc += s.v;
                  const y1 = y(acc);
                  const gap = k > 0 ? 2 : 0; // 2px surface gap between stacked segments
                  return (
                    <path key={k} d={barPath(x, y1, bw, Math.max(0, y0 - y1 - gap), k === segs.length - 1)} fill={colorFor(s.j, dark)} />
                  );
                })}
                {i === weeks.length - 1 || w.minutes === Math.max(...weeks.map((q) => q.minutes)) ? (
                  w.minutes > 0 && (
                    <text className="val" x={x + bw / 2} y={y(H(w.minutes)) - 5} textAnchor="middle">{H(w.minutes)}</text>
                  )
                ) : null}
                <rect
                  className={`hit ${hover === i ? "on" : ""}`}
                  x={m.l + band * i}
                  y={m.t}
                  width={band}
                  height={ih}
                  onMouseEnter={() => setHover(i)}
                  onClick={() => setHover(hover === i ? null : i)}
                />
              </g>
            );
          })}
        </svg>
      )}
      <Tip tip={tip} />
      <div className="legend">
        {jobs.map((j) => (
          <span key={j.id}>
            <i className="swatch" style={{ background: colorFor(j, dark) }} />
            {j.name}
          </span>
        ))}
        {limit > 0 && (
          <span>
            <i className="key-line" /> Weekly limit
          </span>
        )}
        <span className="faint">Faded bar = this week so far</span>
      </div>
      <details className="table-view">
        <summary>Show as table</summary>
        <table className="sheet">
          <thead>
            <tr>
              <th>Week of</th>
              {jobs.map((j) => (
                <th key={j.id}>{j.name}</th>
              ))}
              <th>Total</th>
              <th>Pay</th>
            </tr>
          </thead>
          <tbody>
            {[...stats.weeks].reverse().map((w) => (
              <tr key={w.range.start}>
                <th>{fmtShort(w.range.start)}</th>
                {jobs.map((j) => (
                  <td key={j.id}>{H(w.byJob[j.id] ?? 0)}</td>
                ))}
                <td>{H(w.minutes)}</td>
                <td>{money(w.pay)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function ReconChart({ stats }: { stats: Stats }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const rows = stats.reconciliation.slice(-6);
  const rowH = 44;
  const m = { t: 6, r: 44, b: 22, l: 64 };
  const height = m.t + m.b + rows.length * rowH;
  const iw = Math.max(0, width - m.l - m.r);
  const top = niceMax(Math.max(...rows.map((r) => Math.max(H(r.loggedMin), H(r.paidMin)))), 5);
  const x = (v: number) => m.l + (v / top) * iw;
  const bh = 12;
  const ticks = Array.from({ length: Math.floor(top / 5) + 1 }, (_, i) => i * 5);

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Logged hours versus paid hours per paycheck">
          <g className="axis">
            {ticks.map((t) => (
              <g key={t}>
                <line className={t === 0 ? "baseline" : "gridline"} x1={x(t)} x2={x(t)} y1={m.t} y2={height - m.b} />
                <text x={x(t)} y={height - 6} textAnchor="middle">{t}</text>
              </g>
            ))}
            {rows.map((r, i) => (
              <text key={r.paycheck.id} x={m.l - 8} y={m.t + i * rowH + rowH / 2 + 3.5} textAnchor="end">
                {fmtShort(r.paycheck.payDate)}
              </text>
            ))}
          </g>
          {rows.map((r, i) => {
            const y0 = m.t + i * rowH + (rowH - (bh * 2 + 2)) / 2;
            return (
              <g key={r.paycheck.id}>
                <path d={hbarPath(x(0), y0, x(H(r.loggedMin)) - x(0), bh)} fill="var(--ink-3)" />
                <path d={hbarPath(x(0), y0 + bh + 2, x(H(r.paidMin)) - x(0), bh)} fill="var(--ink)" />
                <text className="val" x={x(Math.max(H(r.loggedMin), H(r.paidMin))) + 6} y={y0 + bh + 4}>
                  {r.diffMin >= 0 ? "+" : "−"}
                  {Math.abs(H(r.diffMin))}
                </text>
                <rect
                  className={`hit ${hover === i ? "on" : ""}`}
                  x={m.l}
                  y={m.t + i * rowH}
                  width={iw + m.r}
                  height={rowH}
                  onMouseEnter={() => setHover(i)}
                  onClick={() => setHover(hover === i ? null : i)}
                />
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && rows[hover] && (
        <Tip
          tip={{
            x: Math.min(Math.max(width / 2, 90), width - 90),
            y: m.t + hover * rowH + 4,
            content: (
              <>
                <b>
                  Paid {fmtShort(rows[hover].paycheck.payDate)} · {money(rows[hover].paycheck.gross)}
                </b>
                <div className="row"><span>Logged here</span><span>{H(rows[hover].loggedMin)} h</span></div>
                <div className="row"><span>Paid</span><span>{H(rows[hover].paidMin)} h</span></div>
                <div className="row"><span>Difference</span><span>{H(rows[hover].diffMin)} h</span></div>
              </>
            ),
          }}
        />
      )}
      <div className="legend">
        <span><i className="swatch" style={{ background: "var(--ink-3)" }} /> Logged in this app</span>
        <span><i className="swatch" style={{ background: "var(--ink)" }} /> Paid on the stub</span>
      </div>
    </div>
  );
}

function WeekdayChart({ stats }: { stats: Stats }) {
  const dark = useDark();
  const [ref, width] = useWidth<HTMLDivElement>();
  const order = [1, 2, 3, 4, 5, 6, 0];
  const vals = order.map((d) => H(stats.weekday[d]));
  const rowH = 26;
  const m = { t: 4, r: 48, b: 4, l: 44 };
  const height = m.t + m.b + rowH * 7;
  const iw = Math.max(0, width - m.l - m.r);
  const top = Math.max(1, ...vals);
  const fill = dark ? "#3987e5" : "#2a78d6";
  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Total logged hours by weekday">
          <line className="baseline" x1={m.l} x2={m.l} y1={m.t} y2={height - m.b} />
          {order.map((d, i) => {
            const y0 = m.t + i * rowH + 6;
            const w = (vals[i] / top) * iw;
            return (
              <g key={d}>
                <text className="axis" x={m.l - 8} y={y0 + 10} textAnchor="end" style={{ fontFamily: "var(--mono)", fontSize: 10.5, fill: "var(--ink-3)" }}>
                  {WEEKDAYS[d].slice(0, 3)}
                </text>
                <path d={hbarPath(m.l, y0, w, 14)} fill={fill} />
                <text className="val" x={m.l + w + 6} y={y0 + 10.5}>
                  {vals[i] ? `${vals[i]} h` : "—"}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
