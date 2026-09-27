"use client";

import { useState } from "react";
import type { Job, Shift } from "@/lib/types";
import { addDays, fmtHM, shiftMinutes } from "@/lib/time";
import { colorFor, Dialog, useDark } from "./ui";

export type Draft = Omit<Shift, "id" | "updatedAt"> & { id?: string };

export default function ShiftDialog({
  draft,
  jobs,
  onSave,
  onClose,
  onDelete,
}: {
  draft: Draft;
  jobs: Job[];
  onSave: (d: Draft) => Promise<boolean>;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const dark = useDark();
  const [d, setD] = useState<Draft>(draft);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const total = shiftMinutes({ ...d, id: "", updatedAt: 0 } as Shift);
  const overnight = d.end && d.end < d.start;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const ok = await onSave(d);
    if (!ok) setSaving(false);
  }

  return (
    <Dialog title={d.id ? "Edit entry" : "New entry"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="field">
          <span>Job</span>
          <div className="radio-list" role="radiogroup">
            {jobs.map((j) => (
              <label key={j.id}>
                <input type="radio" name="job" checked={d.jobId === j.id} onChange={() => set("jobId", j.id)} />
                <i className="swatch" style={{ background: colorFor(j, dark) }} />
                {j.name}
                <span className="faint small mono" style={{ marginLeft: "auto" }}>${j.rate}/h</span>
              </label>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Date</span>
          <input type="date" value={d.date} onChange={(e) => set("date", e.target.value)} required />
        </label>

        <div className="row3">
          <label className="field">
            <span>In</span>
            <input type="time" value={d.start} onChange={(e) => set("start", e.target.value)} required />
          </label>
          <label className="field">
            <span>Out</span>
            <input type="time" value={d.end ?? ""} onChange={(e) => set("end", e.target.value || null)} />
          </label>
          <label className="field">
            <span>Break min</span>
            <input
              type="number"
              min={0}
              max={600}
              step={5}
              inputMode="numeric"
              value={d.breakMin}
              onChange={(e) => set("breakMin", Number(e.target.value))}
            />
          </label>
        </div>

        <label className="field">
          <span>Note</span>
          <input value={d.note} onChange={(e) => set("note", e.target.value)} maxLength={300} placeholder="Optional" />
        </label>

        <div className="readout">
          <span className="label">{d.end ? (overnight ? "Total · ends next day" : "Total") : "Still clocked in"}</span>
          <b>{d.end ? fmtHM(total) : "—"}</b>
        </div>

        <div className="dialog-actions">
          <div>
            {onDelete && (
              <button type="button" className="btn danger" onClick={onDelete}>
                Delete
              </button>
            )}
            {d.id && (
              <button
                type="button"
                className="btn quiet"
                title="Same shift, one week later"
                onClick={() => setD({ ...d, id: undefined, date: addDays(d.date, 7) })}
              >
                Copy to next week
              </button>
            )}
          </div>
          <button className="btn solid" disabled={saving}>
            {saving ? "Saving…" : "Save entry"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
