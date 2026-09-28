import { fail, handle, json } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { createInvite, listInvites, OWNER_ID } from "@/lib/users";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const { uid } = await requireUser();
  return json({ invites: await listInvites(uid) });
});

/**
 * POST { self: true }     -> link to add another device to your own account (anyone)
 * POST { name: "Alex" }   -> link that creates a new account for a friend (owner only)
 * The code is only returned here, once; the server stores just its hash.
 */
export const POST = handle(async (req: Request) => {
  const { uid } = await requireUser();
  const body = (await req.json().catch(() => ({}))) as { self?: boolean; name?: string };
  if (body.self) {
    const { code, invite } = await createInvite({ userId: uid, name: "", createdBy: uid });
    return json({ code, invite }, 201);
  }
  if (uid !== OWNER_ID) return fail("Only the account owner can invite new people.", 403);
  const name = (body.name || "").trim().slice(0, 40);
  if (!name) return fail("Enter your friend's name.");
  const pending = (await listInvites(uid)).filter((i) => i.userId === null);
  if (pending.length >= 10) return fail("Too many pending invites. Revoke some first.");
  const { code, invite } = await createInvite({ userId: null, name, createdBy: uid });
  return json({ code, invite }, 201);
});
