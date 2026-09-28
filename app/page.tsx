import { redirect } from "next/navigation";
import { ensureSeeded, getSettings } from "@/lib/data";
import { currentUser } from "@/lib/session";
import { userStore } from "@/lib/users";
import type { Paycheck, Shift } from "@/lib/types";
import Tracker from "./Tracker";

export const dynamic = "force-dynamic";

export default async function Home() {
  const me = await currentUser();
  if (!me) redirect("/login");
  await ensureSeeded(me.uid);
  const db = userStore(me.uid);
  const [settings, shifts, paychecks] = await Promise.all([
    getSettings(me.uid),
    db.hgetall<Shift>("shifts"),
    db.hgetall<Paycheck>("paychecks"),
  ]);
  return (
    <Tracker
      initialSettings={settings}
      initialShifts={Object.values(shifts)}
      initialPaychecks={Object.values(paychecks)}
    />
  );
}
