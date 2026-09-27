import { fail, handle, json } from "@/lib/api";
import { getSettings, validateSettings } from "@/lib/data";
import { requireDevice } from "@/lib/session";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  await requireDevice();
  return json({ settings: await getSettings() });
});

export const PUT = handle(async (req: Request) => {
  await requireDevice();
  const settings = validateSettings(await req.json().catch(() => null));
  if (typeof settings === "string") return fail(settings);
  await store().set("settings", settings);
  return json({ settings });
});
