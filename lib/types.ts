export type Job = {
  id: string;
  name: string;
  rate: number; // $/hr
  color: string; // one of JOB_COLORS (light-mode hex)
};

export type Shift = {
  id: string;
  jobId: string;
  date: string; // YYYY-MM-DD (the day the shift started)
  start: string; // HH:MM (24h)
  end: string | null; // HH:MM, null while clocked in
  breakMin: number;
  note: string;
  updatedAt: number;
};

/** A paycheck as printed on the pay advice. Used to compare logged hours against paid hours. */
export type Paycheck = {
  id: string;
  payDate: string; // YYYY-MM-DD
  periodStart: string;
  periodEnd: string;
  hours: number;
  gross: number;
  net: number;
  note: string;
};

export type Settings = {
  jobs: Job[];
  /** Any Sunday that starts a biweekly pay period, YYYY-MM-DD */
  payPeriodAnchor: string;
  /** 0 = weeks start Sunday (UMass payroll), 1 = Monday */
  weekStartsOn: 0 | 1;
  /** Soft weekly cap across all jobs; drawn on charts and used for warnings. 0 = off */
  weeklyLimit: number;
  /** Days between the end of a pay period and payday (Sat 9/19 -> Fri 9/25 = 6) */
  payLagDays: number;
};

/**
 * Categorical job colors, in fixed order (validated for color-blind separation).
 * Each has a light- and dark-surface step; the stored value is the light one.
 */
export const JOB_COLORS: { light: string; dark: string; name: string }[] = [
  { light: "#2a78d6", dark: "#3987e5", name: "Blue" },
  { light: "#eb6834", dark: "#d95926", name: "Orange" },
  { light: "#1baf7a", dark: "#199e70", name: "Aqua" },
  { light: "#eda100", dark: "#c98500", name: "Yellow" },
  { light: "#e87ba4", dark: "#d55181", name: "Magenta" },
  { light: "#008300", dark: "#008300", name: "Green" },
  { light: "#4a3aa7", dark: "#9085e9", name: "Violet" },
  { light: "#e34948", dark: "#e66767", name: "Red" },
];

export const DEFAULT_SETTINGS: Settings = {
  jobs: [
    { id: "isenberg", name: "Isenberg TSS", rate: 16, color: JOB_COLORS[0].light },
    { id: "del", name: "Digital Evidence Lab", rate: 16, color: JOB_COLORS[1].light },
  ],
  payPeriodAnchor: "2026-09-06",
  weekStartsOn: 0,
  weeklyLimit: 20,
  payLagDays: 6,
};
