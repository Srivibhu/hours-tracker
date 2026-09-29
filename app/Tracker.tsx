"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Job, Paycheck, Settings, Shift } from "@/lib/types";
import { computeStats, fmtWeekday } from "@/lib/analytics";
import { fmt12, fmtHM, fmtHours, money, nowHHMM, shiftMinutes, todayLocal } from "@/lib/time";
import { api, colorFor, ThemeToggle, useDark } from "./ui";
import ShiftDialog, { type Draft } from "./ShiftDialog";
import PaycheckDialog, { type PayDraft } from "./PaycheckDialog";
import Timesheet, { type View } from "./Timesheet";
import Insights from "./Insights";
import SettingsView from "./SettingsView";

type Tab = "sheet" | "insights" | "settings";

export default function Tracker({
  initialSettings,
  initialShifts,
  initialPaychecks,
}: {
  initialSettings: Settings;
  initialShifts: Shift[];
  initialPaychecks: Paycheck[];
}) {
  const dark = useDark();
  const [tab, setTab] = useState<Tab>("sheet");
  const [settings, setSettings] = useState(initialSettings);
  const [shifts, setShifts] = useState(initialShifts);
  const [paychecks, setPaychecks] = useState(initialPaychecks);
  const [now, setNow] = useState(() => ({ date: todayLocal(), time: nowHHMM() }));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [payDraft, setPayDraft] = useState<PayDraft | null>(null);
  const [toast, setToast] = useState("");
  const [focus, setFocus] = useState<{ view: View; nonce: number } | null>(null);
  const today = now.date;

  const jobs = useMemo(() => new Map(settings.jobs.map((j) => [j.id, j])), [settings.jobs]);
  const job = useCallback((id: string): Job | undefined => jobs.get(id), [jobs]);
  const stats = useMemo(() => computeStats(shifts, paychecks, settings, today, now), [shifts, paychecks, settings, today, now]);
  const openShift = shifts.find((s) => s.end === null);

  useEffect(() => {
    const t = setInterval(() => setNow({ date: todayLocal(), time: nowHHMM() }), 20000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [a, b, c] = await Promise.all([
        api<{ shifts: Shift[] }>("/api/shifts"),
        api<{ settings: Settings }>("/api/settings"),
        api<{ paychecks: Paycheck[] }>("/api/paychecks"),
      ]);
      setShifts(a.shifts);
      setSettings(b.settings);
      setPaychecks(c.paychecks);
      setNow({ date: todayLocal(), time: nowHHMM() });
    } catch {}
  }, []);
  useEffect(() => {
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const fail = (e: unknown) => alert(e instanceof Error ? e.message : "Something went wrong");

  async function saveShift(d: Draft): Promise<boolean> {
    const { id, ...body } = d;
    try {
      if (id) {
        const { shift } = await api<{ shift: Shift }>(`/api/shifts/${id}`, "PUT", body);
        setShifts((all) => all.map((s) => (s.id === id ? shift : s)));
        setToast("Entry updated");
      } else {
        const { shifts: created } = await api<{ shifts: Shift[] }>("/api/shifts", "POST", body);
        setShifts((all) => [...all, ...created]);
        setToast("Entry added");
      }
      setDraft(null);
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  }

  async function deleteShift(id: string) {
    if (!confirm("Delete this entry?")) return;
    try {
      await api(`/api/shifts/${id}`, "DELETE");
      setShifts((all) => all.filter((s) => s.id !== id));
      setDraft(null);
      setToast("Entry deleted");
    } catch (e) {
      fail(e);
    }
  }

  async function savePaycheck(p: PayDraft): Promise<boolean> {
    const { id, ...body } = p;
    try {
      if (id) {
        const { paycheck } = await api<{ paycheck: Paycheck }>(`/api/paychecks/${id}`, "PUT", body);
        setPaychecks((all) => all.map((x) => (x.id === id ? paycheck : x)));
      } else {
        const { paycheck } = await api<{ paycheck: Paycheck }>("/api/paychecks", "POST", body);
        setPaychecks((all) => [...all, paycheck]);
      }
      setPayDraft(null);
      setToast("Paycheck saved");
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  }

  async function deletePaycheck(id: string) {
    if (!confirm("Delete this paycheck?")) return;
    try {
      await api(`/api/paychecks/${id}`, "DELETE");
      setPaychecks((all) => all.filter((x) => x.id !== id));
      setPayDraft(null);
    } catch (e) {
      fail(e);
    }
  }

  const clockIn = (jobId: string) =>
    saveShift({ jobId, date: todayLocal(), start: nowHHMM(), end: null, breakMin: 0, note: "" });
  const clockOut = () => openShift && saveShift({ ...openShift, end: nowHHMM() });

  function newEntry(date: string) {
    const last = [...shifts].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    setDraft({ jobId: last?.jobId ?? settings.jobs[0]?.id ?? "", date, start: "09:00", end: "12:00", breakMin: 0, note: "" });
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const r = stats.ranges;
  const week = stats.agg.thisWeek;
  const limit = settings.weeklyLimit;
  const weekPct = limit > 0 ? Math.min(100, (week.minutes / 60 / limit) * 100) : 0;
  const left = limit - week.minutes / 60;
  const up = stats.upcoming;
  const goTo = (view: View) => {
    setTab("sheet");
    setFocus({ view, nonce: Date.now() });
  };

  return (
    <div className="page">
      <header className="masthead">
        <div className="wordmark">Hours</div>
        <nav className="nav">
          <div className="seg">
            <button aria-current={tab === "sheet" ? "page" : undefined} onClick={() => setTab("sheet")}>Timesheet</button>
            <button aria-current={tab === "insights" ? "page" : undefined} onClick={() => setTab("insights")}>Insights</button>
            <button aria-current={tab === "settings" ? "page" : undefined} onClick={() => setTab("settings")}>Settings</button>
          </div>
          <ThemeToggle />
          <button className="signout" onClick={signOut}>Sign out</button>
        </nav>
      </header>

      <div className={`card clock ${openShift ? "on" : ""}`}>
        {openShift ? (
          <>
            <div className="status">
              <i className="lamp on" aria-hidden />
              <span>
                Working at <b>{job(openShift.jobId)?.name ?? "Unknown"}</b>
                <span className="muted"> since {fmt12(openShift.start)}</span>
              </span>
            </div>
            <span className="elapsed">{fmtHM(shiftMinutes(openShift, now))}</span>
            <button className="btn solid" onClick={clockOut}>Clock out</button>
          </>
        ) : (
          <>
            <div className="status">
              <i className="lamp" aria-hidden />
              <span className="muted">Not clocked in</span>
            </div>
            <div className="jobs">
              {settings.jobs.map((j) => (
                <button key={j.id} className="btn" onClick={() => clockIn(j.id)}>
                  <i className="swatch" style={{ background: colorFor(j, dark) }} />
                  Clock in · {j.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="summary">
        <button className="card stat" onClick={() => goTo("week")}>
          <span className="label">This week</span>
          <span className="figure">
            {fmtHours(week.minutes)}
            <small>h</small>
          </span>
          {limit > 0 && (
            <>
              <div className={`meter ${left < 0 ? "over" : left < 3 ? "warn" : ""}`} aria-hidden>
                <i style={{ width: `${weekPct}%` }} />
              </div>
              <span className={`note ${left < 0 ? "down" : left < 3 ? "warn" : ""}`}>
                {left < 0 ? `${fmtHours(-left * 60)} h over your ${limit} h limit` : `${fmtHours(left * 60)} h left of ${limit} h`}
              </span>
            </>
          )}
          <Pace hours={stats.deltas.week.hours} vs="last week" />
        </button>

        <button className="card stat" onClick={() => goTo("period")}>
          <span className="label">Pay period · {r.thisPeriod.label}</span>
          <span className="figure">
            {fmtHours(stats.agg.thisPeriod.minutes)}
            <small>h</small>
          </span>
          <span className="sub num">{money(stats.agg.thisPeriod.pay)} earned</span>
          <Pace hours={stats.deltas.period.hours} vs="last period" />
        </button>

        <button className="card stat pay" onClick={() => setTab("insights")}>
          <span className="label">Next paycheck · {fmtWeekday(up.date)}</span>
          <span className="figure">{money(up.estimate)}</span>
          <span className="sub">
            {up.final ? "Estimate for" : "Projected for"} {up.range.label}
          </span>
          <span className="note">{fmtHours(up.agg.minutes)} h logged{up.final ? "" : " so far"}</span>
        </button>
      </div>

      {tab === "sheet" && (
        <Timesheet
          shifts={shifts}
          settings={settings}
          now={now}
          focus={focus}
          onEdit={(s) => setDraft({ ...s })}
          onNew={newEntry}
          onImported={refresh}
          setToast={setToast}
        />
      )}
      {tab === "insights" && (
        <Insights
          stats={stats}
          settings={settings}
          paychecks={paychecks}
          onEditPaycheck={(p) => setPayDraft({ ...p })}
          onNewPaycheck={() => {
            const last = r.lastPeriod;
            setPayDraft({ payDate: today, periodStart: last.start, periodEnd: last.end, hours: 0, gross: 0, net: 0, note: "" });
          }}
        />
      )}
      {tab === "settings" && (
        <SettingsView
          settings={settings}
          onSaved={(s) => {
            setSettings(s);
            setToast("Settings saved");
          }}
          onImported={async (msg) => {
            await refresh();
            setToast(msg);
          }}
        />
      )}

      {draft && (
        <ShiftDialog
          key={draft.id ?? "new"}
          draft={draft}
          jobs={settings.jobs}
          onSave={saveShift}
          onClose={() => setDraft(null)}
          onDelete={draft.id ? () => deleteShift(draft.id!) : undefined}
        />
      )}
      {payDraft && (
        <PaycheckDialog
          draft={payDraft}
          onSave={savePaycheck}
          onClose={() => setPayDraft(null)}
          onDelete={payDraft.id ? () => deletePaycheck(payDraft.id!) : undefined}
        />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

/** Plain-language pace vs the same point in the previous range. Neutral unless the gap is real. */
function Pace({ hours, vs }: { hours: number; vs: string }) {
  const abs = Math.round(Math.abs(hours) * 100) / 100;
  if (abs < 0.01) return <span className="pace">Same pace as {vs}</span>;
  return (
    <span className="pace">
      <b className={hours > 0 ? "up" : ""}>{hours > 0 ? "▲" : "▼"} {abs} h</b> {hours > 0 ? "ahead of" : "behind"} {vs} at this point
    </span>
  );
}
