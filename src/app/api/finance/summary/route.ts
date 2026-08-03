import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { financeService } from "@/services/finance-service";

export const runtime = "nodejs";

/** Financial summary — `finance.read` enforced inside the service (no leak). */
export async function GET() {
  try {
    const user = await requireUser();
    return ok(await financeService.summary(user));
  } catch (err) {
    return handleError(err);
  }
}
