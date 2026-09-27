"use client";

import { useState } from "react";
import type { Paycheck } from "@/lib/types";
import { Dialog } from "./ui";

export type PayDraft = Omit<Paycheck, "id"> & { id?: string };

export default function PaycheckDialog({
  draft,
  onSave,
  onClose,
  onDelete,
}: {
  draft: PayDraft;
  onSave: (p: PayDraft) => Promise<boolean>;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [p, setP] = useState<PayDraft>(draft);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof PayDraft>(k: K, v: PayDraft[K]) => setP((x) => ({ ...x, [k]: v }));

  return (
    <Dialog title={p.id ? "Edit paycheck" : "Add paycheck"} onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          if (!(await onSave(p))) setSaving(false);
        }}
      >
        <p className="small muted">Copy these from the pay advice in HR Direct. They let the app compare paid hours to what you logged.</p>
        <label className="field">
          <span>Pay date</span>
          <input type="date" value={p.payDate} onChange={(e) => set("payDate", e.target.value)} required />
        </label>
        <div className="row2">
          <label className="field">
            <span>Period begins</span>
            <input type="date" value={p.periodStart} onChange={(e) => set("periodStart", e.target.value)} required />
          </label>
          <label className="field">
            <span>Period ends</span>
            <input type="date" value={p.periodEnd} onChange={(e) => set("periodEnd", e.target.value)} required />
          </label>
        </div>
        <div className="row3">
          <label className="field">
            <span>Hours</span>
            <input type="number" step="0.01" min={0} inputMode="decimal" value={p.hours} onChange={(e) => set("hours", Number(e.target.value))} />
          </label>
          <label className="field">
            <span>Gross $</span>
            <input type="number" step="0.01" min={0} inputMode="decimal" value={p.gross} onChange={(e) => set("gross", Number(e.target.value))} />
          </label>
          <label className="field">
            <span>Net $</span>
            <input type="number" step="0.01" min={0} inputMode="decimal" value={p.net} onChange={(e) => set("net", Number(e.target.value))} />
          </label>
        </div>
        <label className="field">
          <span>Note</span>
          <input value={p.note} onChange={(e) => set("note", e.target.value)} maxLength={300} placeholder="Optional" />
        </label>
        <div className="dialog-actions">
          <div>
            {onDelete && (
              <button type="button" className="btn danger" onClick={onDelete}>
                Delete
              </button>
            )}
          </div>
          <button className="btn solid" disabled={saving}>
            {saving ? "Saving…" : "Save paycheck"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
