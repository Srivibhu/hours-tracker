import { handle, json } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { OWNER_ID } from "@/lib/users";
import { credentialsFor, maxDevices } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const { cid, uid } = await requireUser();
  const devices = (await credentialsFor(uid))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((c) => ({
      id: c.id,
      name: c.name,
      createdAt: c.createdAt,
      lastUsedAt: c.lastUsedAt,
      current: c.id === cid,
    }));
  return json({ devices, maxDevices: maxDevices(), isOwner: uid === OWNER_ID });
});
