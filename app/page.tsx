import { redirect } from "next/navigation";
import { ensureSeeded, getSettings } from "@/lib/data";
import { currentDevice } from "@/lib/session";
import { store } from "@/lib/store";
import type { Paycheck, Shift } from "@/lib/types";
import Tracker from "./Tracker";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await currentDevice())) redirect("/login");
  await ensureSeeded();
  const [settings, shifts, paychecks] = await Promise.all([
    getSettings(),
    store().hgetall<Shift>("shifts"),
    store().hgetall<Paycheck>("paychecks"),
  ]);
  return (
    <Tracker
      initialSettings={settings}
      initialShifts={Object.values(shifts)}
      initialPaychecks={Object.values(paychecks)}
    />
  );
}
