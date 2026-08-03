import { requireUser } from "@/lib/auth";
import { assertPermission, PERMISSION_DOMAINS } from "@/lib/iam";
import { ok, handleError } from "@/lib/http";

export const runtime = "nodejs";

/** The permission catalog (grouped by domain) for the permission-matrix UI. */
export async function GET() {
  try {
    const user = await requireUser();
    assertPermission(user, "roles.manage");
    return ok({ domains: PERMISSION_DOMAINS });
  } catch (err) {
    return handleError(err);
  }
}
