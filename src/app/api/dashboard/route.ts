import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { dashboardService } from "@/services/dashboard-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    assertCan(user, "dashboard:view");
    return ok(await dashboardService.summary(user));
  } catch (err) {
    return handleError(err);
  }
}
