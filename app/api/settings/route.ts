import { fail, handle, json } from "@/lib/api";
import { getSettings, validateSettings } from "@/lib/data";
import { requireUser } from "@/lib/session";
import { userStore } from "@/lib/users";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const { uid } = await requireUser();
  return json({ settings: await getSettings(uid) });
});

export const PUT = handle(async (req: Request) => {
  const { uid } = await requireUser();
  const settings = validateSettings(await req.json().catch(() => null));
  if (typeof settings === "string") return fail(settings);
  await userStore(uid).set("settings", settings);
  return json({ settings });
});
