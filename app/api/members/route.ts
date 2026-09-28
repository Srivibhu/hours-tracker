import { handle, json, fail } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { listUsers, OWNER_ID } from "@/lib/users";
import { listCredentials } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

/** Owner only: everyone who has an account besides you. */
export const GET = handle(async () => {
  const { uid } = await requireUser();
  if (uid !== OWNER_ID) return fail("Only the account owner can see this.", 403);
  const creds = await listCredentials();
  const members = (await listUsers())
    .filter((u) => u.id !== OWNER_ID)
    .map((u) => {
      const mine = creds.filter((c) => c.userId === u.id);
      return {
        id: u.id,
        name: u.name,
        createdAt: u.createdAt,
        devices: mine.length,
        lastUsedAt: mine.reduce<number | null>((m, c) => (c.lastUsedAt && (!m || c.lastUsedAt > m) ? c.lastUsedAt : m), null),
      };
    });
  return json({ members });
});
