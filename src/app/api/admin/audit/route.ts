import { requireUser } from "@/lib/auth";
import { assertPermission } from "@/lib/iam";
import { ok, handleError } from "@/lib/http";
import { auditService } from "@/services/audit-service";

export const runtime = "nodejs";

/** Immutable audit trail (append-only). Requires `audit.view`. */
export async function GET() {
  try {
    const user = await requireUser();
    assertPermission(user, "audit.view");
    return ok(await auditService.list(user));
  } catch (err) {
    return handleError(err);
  }
}
