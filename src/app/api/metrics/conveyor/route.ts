import { requireUser } from "@/lib/auth";
import { assertPermission } from "@/lib/iam";
import { ok, handleError } from "@/lib/http";
import { conveyorMetricsService } from "@/services/conveyor-metrics-service";

export const runtime = "nodejs";

/** Conveyor throughput analytics (managers/owner). */
export async function GET() {
  try {
    const user = await requireUser();
    assertPermission(user, "sales.read");
    return ok(await conveyorMetricsService.summary(user));
  } catch (err) {
    return handleError(err);
  }
}
