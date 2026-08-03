import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";

export const runtime = "nodejs";

/** Current user + resolved permissions — used by the UI to gate nav/pages/buttons. */
export async function GET() {
  try {
    const u = await requireUser();
    return ok({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      orgId: u.orgId,
      isOwner: u.isOwner,
      permissions: u.permissions,
    });
  } catch (err) {
    return handleError(err);
  }
}
