import { handle, json } from "@/lib/api";
import { requireDevice } from "@/lib/session";
import { listCredentials, maxDevices } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const current = await requireDevice();
  const devices = (await listCredentials())
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((c) => ({
      id: c.id,
      name: c.name,
      createdAt: c.createdAt,
      lastUsedAt: c.lastUsedAt,
      current: c.id === current,
    }));
  return json({ devices, maxDevices: maxDevices() });
});
