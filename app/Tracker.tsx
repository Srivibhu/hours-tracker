"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Job, Paycheck, Settings, Shift } from "@/lib/types";
import { computeStats } from "@/lib/analytics";
import { fmt12, fmtHM, money, nowHHMM, shiftMinutes, todayLocal } from "@/lib/time";
import { api, colorFor, Delta, useDark } from "./ui";
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
  const strip: { view: View; label: string; agg: typeof stats.agg.thisWeek; d: typeof stats.deltas.week; vs: string }[] = [
    { view: "week", label: "This week", agg: stats.agg.thisWeek, d: stats.deltas.week, vs: "vs last wk" },
    { view: "period", label: "Pay period", agg: stats.agg.thisPeriod, d: stats.deltas.period, vs: "vs last pd." },
    { view: "month", label: r.thisMonth.label.split(" ")[0], agg: stats.agg.thisMonth, d: stats.deltas.month, vs: "vs last mo." },
  ];

  return (
    <div className="page">
      <header className="masthead">
        <div className="wordmark">
          Hours <span>/ timecard</span>
        </div>
        <nav className="nav">
          <button aria-current={tab === "sheet" ? "page" : undefined} onClick={() => setTab("sheet")}>Timesheet</button>
          <button aria-current={tab === "insights" ? "page" : undefined} onClick={() => setTab("insights")}>Insights</button>
          <button aria-current={tab === "settings" ? "page" : undefined} onClick={() => setTab("settings")}>Settings</button>
          <button onClick={signOut}>Sign out</button>
        </nav>
      </header>

      <div className="clockline">
        {openShift ? (
          <>
            <div className="status">
              <i className="lamp on" aria-hidden />
              <span>
                On the clock at <b>{job(openShift.jobId)?.name ?? "Unknown"}</b>
                <span className="faint"> since {fmt12(openShift.start)}</span>
              </span>
            </div>
            <span className="elapsed">{fmtHM(shiftMinutes(openShift, now))}</span>
            <button className="btn solid" onClick={clockOut}>Clock out</button>
          </>
        ) : (
          <>
            <div className="status">
              <i className="lamp" aria-hidden />
              <span className="muted">Off the clock</span>
            </div>
            <span className="label">Clock in</span>
            {settings.jobs.map((j) => (
              <button key={j.id} className="btn" onClick={() => clockIn(j.id)}>
                <i className="swatch" style={{ background: colorFor(j, dark) }} />
                {j.name}
              </button>
            ))}
          </>
        )}
      </div>

      <div className="strip">
        {strip.map((s) => (
          <button
            key={s.view}
            onClick={() => {
              setTab("sheet");
              setFocus({ view: s.view, nonce: Date.now() });
            }}
          >
            <span className="label">{s.label}</span>
            <span className="figure">
              {Math.round((s.agg.minutes / 60) * 100) / 100}
              <small>h</small>
            </span>
            <span className="small muted mono num">{money(s.agg.pay)}</span>
            {s.d.pct === null && s.d.hours > 0 ? (
              <span className="delta faint">nothing logged {s.vs.replace("vs ", "")}</span>
            ) : (
              <Delta hours={s.d.hours} pct={s.d.pct} suffix={s.vs} />
            )}
          </button>
        ))}
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
