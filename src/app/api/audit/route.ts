import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { auditService } from "@/services/audit-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    assertCan(user, "audit:read");
    return ok(await auditService.list(user));
  } catch (err) {
    return handleError(err);
  }
}
