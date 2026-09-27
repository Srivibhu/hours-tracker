"use client";

import { useEffect, useRef, useState } from "react";
import { JOB_COLORS, type Settings } from "@/lib/types";
import { api, colorFor, useDark } from "./ui";

type DeviceRow = { id: string; name: string; createdAt: number; lastUsedAt: number | null; current: boolean };

/** Minimal CSV parser (handles quoted fields with commas and "" escapes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let f = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') (f += '"'), i++;
      else if (c === '"') q = false;
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") row.push(f), (f = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(f);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      f = "";
    } else f += c;
  }
  row.push(f);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

export default function SettingsView({
  settings,
  onSaved,
  onImported,
}: {
  settings: Settings;
  onSaved: (s: Settings) => void;
  onImported: (msg: string) => void | Promise<void>;
}) {
  const dark = useDark();
  const [s, setS] = useState<Settings>(structuredClone(settings));
  const [devices, setDevices] = useState<DeviceRow[] | null>(null);
  const [maxDevices, setMaxDevices] = useState(2);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ devices: DeviceRow[]; maxDevices: number }>("/api/devices")
      .then((d) => {
        setDevices(d.devices);
        setMaxDevices(d.maxDevices);
      })
      .catch(() => setDevices([]));
  }, []);

  const updateJob = (i: number, patch: Partial<Settings["jobs"][number]>) =>
    setS((x) => ({ ...x, jobs: x.jobs.map((j, k) => (k === i ? { ...j, ...patch } : j)) }));

  async function save() {
    setSaving(true);
    setError("");
    try {
      const { settings: saved } = await api<{ settings: Settings }>("/api/settings", "PUT", s);
      setS(saved);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
    setSaving(false);
  }

  async function removeDevice(d: DeviceRow) {
    if (!confirm(`Remove "${d.name}"? It is signed out right away and needs the setup code to come back.`)) return;
    try {
      await api(`/api/devices/${encodeURIComponent(d.id)}`, "DELETE");
      setDevices((list) => list?.filter((x) => x.id !== d.id) ?? null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not remove device");
    }
  }

  async function importHistory() {
    try {
      const r = await api<{ shifts: number; paychecks: number }>("/api/import", "POST", { kind: "history" });
      await onImported(r.shifts || r.paychecks ? `Imported ${r.shifts} entries, ${r.paychecks} paychecks` : "Already up to date");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Import failed");
    }
  }

  async function importCsv(file: File) {
    try {
      const rows = parseCsv(await file.text());
      const head = rows.shift()?.map((h) => h.trim().toLowerCase()) ?? [];
      const col = (name: string) => head.findIndex((h) => h.startsWith(name));
      const [iDate, iJob, iStart, iEnd, iBreak, iNote] = ["date", "job", "start", "end", "break", "note"].map(col);
      if (iDate < 0 || iJob < 0 || iStart < 0) throw new Error("CSV needs Date, Job and Start columns (same format as Export).");
      const byName = new Map(settings.jobs.map((j) => [j.name.toLowerCase(), j.id]));
      const shifts = rows.map((r, n) => {
        const jobId = byName.get((r[iJob] ?? "").trim().toLowerCase());
        if (!jobId) throw new Error(`Row ${n + 2}: unknown job "${r[iJob]}". Add it under Jobs first.`);
        return {
          jobId,
          date: r[iDate]?.trim(),
          start: r[iStart]?.trim().slice(0, 5),
          end: iEnd >= 0 && r[iEnd]?.trim() ? r[iEnd].trim().slice(0, 5) : null,
          breakMin: iBreak >= 0 ? Number(r[iBreak]) || 0 : 0,
          note: iNote >= 0 ? r[iNote] ?? "" : "",
        };
      });
      const res = await api<{ shifts: number; skipped: number }>("/api/import", "POST", { kind: "shifts", shifts });
      await onImported(`Imported ${res.shifts} entries${res.skipped ? `, skipped ${res.skipped} duplicates` : ""}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Import failed");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <section className="section">
        <div className="section-head">
          <h2>Jobs &amp; rates</h2>
        </div>
        <div style={{ paddingTop: 8 }}>
          {s.jobs.map((j, i) => (
            <div key={j.id} className="job-row">
              <button
                type="button"
                className="swatch-btn"
                style={{ background: colorFor(j, dark) }}
                aria-label={`Color: ${JOB_COLORS.find((c) => c.light === j.color)?.name ?? "custom"}. Tap to change.`}
                title="Tap to change color"
                onClick={() => {
                  const idx = JOB_COLORS.findIndex((c) => c.light === j.color);
                  updateJob(i, { color: JOB_COLORS[(idx + 1) % JOB_COLORS.length].light });
                }}
              />
              <input value={j.name} onChange={(e) => updateJob(i, { name: e.target.value })} aria-label="Job name" />
              <input
                type="number"
                step="0.01"
                min={0}
                inputMode="decimal"
                value={j.rate}
                onChange={(e) => updateJob(i, { rate: Number(e.target.value) })}
                aria-label={`${j.name} hourly rate`}
              />
              <button
                className="x"
                aria-label={`Remove ${j.name}`}
                disabled={s.jobs.length === 1}
                onClick={() => {
                  if (confirm(`Remove ${j.name}? Its entries stay but show as "Unknown job".`))
                    setS((x) => ({ ...x, jobs: x.jobs.filter((_, k) => k !== i) }));
                }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="linkbtn"
            style={{ marginTop: 6 }}
            onClick={() =>
              setS((x) => ({
                ...x,
                jobs: [...x.jobs, { id: crypto.randomUUID().slice(0, 8), name: "New job", rate: 16, color: JOB_COLORS[x.jobs.length % JOB_COLORS.length].light }],
              }))
            }
          >
            + Add a job
          </button>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Pay schedule</h2>
        </div>
        <div className="form" style={{ paddingTop: 12 }}>
          <div className="row2">
            <label className="field">
              <span>A pay period start (Sunday)</span>
              <input type="date" value={s.payPeriodAnchor} onChange={(e) => setS({ ...s, payPeriodAnchor: e.target.value })} />
            </label>
            <label className="field">
              <span>Days from period end to payday</span>
              <input type="number" min={0} max={60} inputMode="numeric" value={s.payLagDays} onChange={(e) => setS({ ...s, payLagDays: Number(e.target.value) })} />
            </label>
          </div>
          <div className="row2">
            <label className="field">
              <span>Weeks start on</span>
              <select value={s.weekStartsOn} onChange={(e) => setS({ ...s, weekStartsOn: Number(e.target.value) as 0 | 1 })}>
                <option value={0}>Sunday (UMass payroll)</option>
                <option value={1}>Monday</option>
              </select>
            </label>
            <label className="field">
              <span>Weekly hour limit (0 = off)</span>
              <input type="number" min={0} max={168} inputMode="numeric" value={s.weeklyLimit} onChange={(e) => setS({ ...s, weeklyLimit: Number(e.target.value) })} />
            </label>
          </div>
          <p className="small muted">Defaults match your stub: the 9/6–9/19 period was paid Fri 9/25.</p>
          {error && <p className="error">{error}</p>}
          <div>
            <button className="btn solid" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </button>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Data</h2>
        </div>
        <div className="actions">
          <button className="btn" onClick={importHistory}>Re-import calendar history</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Import CSV…</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
        </div>
        <p className="section-note">
          Calendar history covers Sep 3–24 (Isenberg TSS and Digital Evidence Lab) plus your 9/11 and 9/25 paychecks. Duplicates are skipped.
          CSV uses the same columns as Export.
        </p>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Devices</h2>
          <span className="label">
            {devices?.length ?? "…"} of {maxDevices}
          </span>
        </div>
        {devices?.map((d) => (
          <div key={d.id} className="device">
            <div>
              <div>
                {d.name}
                {d.current && <span className="tag">This device</span>}
              </div>
              <div className="small faint">
                Added {new Date(d.createdAt).toLocaleDateString()}
                {d.lastUsedAt ? ` · last sign-in ${new Date(d.lastUsedAt).toLocaleDateString()}` : ""}
              </div>
            </div>
            {!d.current && (
              <button className="btn danger" onClick={() => removeDevice(d)}>
                Remove
              </button>
            )}
          </div>
        ))}
        {devices && devices.length < maxDevices && (
          <p className="section-note">To add your other device, open this site on it, choose “Set up a new device”, and enter your setup code.</p>
        )}
      </section>
    </>
  );
}
