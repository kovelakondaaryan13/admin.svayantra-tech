import { requireUser } from "@/lib/auth";
import { assertPermission } from "@/lib/iam";
import { ok, handleError } from "@/lib/http";
import { auditService } from "@/services/audit-service";

export const runtime = "nodejs";

const STRUCTURAL = /^(orgunit|role|object|workflow|policy|permission|employee)\./;

/** Organization timeline — structural changes only, drawn from the immutable audit log. */
export async function GET() {
  try {
    const user = await requireUser();
    assertPermission(user, "audit.view");
    const entries = await auditService.list(user, 300);
    return ok(entries.filter((e) => STRUCTURAL.test(e.action)));
  } catch (err) {
    return handleError(err);
  }
}
