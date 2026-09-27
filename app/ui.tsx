"use client";

import { useEffect, useRef, useState } from "react";
import { JOB_COLORS, type Job } from "@/lib/types";

export async function api<T = unknown>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Signed out");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return dark;
}

/** Job color stepped for the current surface (light/dark steps of the same palette slot). */
export function colorFor(job: Job | undefined, dark: boolean) {
  if (!job) return dark ? "#847f72" : "#8a8677";
  const slot = JOB_COLORS.find((c) => c.light === job.color);
  return slot ? (dark ? slot.dark : slot.light) : job.color;
}

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Signed change with an arrow glyph so direction never relies on color alone. */
export function Delta({
  hours,
  pct,
  suffix,
  mode = "hours",
}: {
  hours: number;
  pct?: number | null;
  suffix: string;
  mode?: "hours" | "pct";
}) {
  const flat = Math.abs(hours) < 0.01;
  const cls = flat ? "faint" : hours > 0 ? "up" : "down";
  const arrow = flat ? "=" : hours > 0 ? "▲" : "▼";
  const value =
    mode === "pct" && pct != null
      ? `${Math.abs(Math.round(pct))}%`
      : `${Math.round(Math.abs(hours) * 100) / 100} h`;
  return (
    <span className={`delta ${cls}`}>
      {arrow} {flat ? "same" : value} <span className="faint">{suffix}</span>
    </span>
  );
}

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-head">
          <h2>{title}</h2>
          <button className="linkbtn" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
