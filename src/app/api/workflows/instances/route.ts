import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { workflowService } from "@/services/workflow-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await workflowService.listInstances(user));
  } catch (err) {
    return handleError(err);
  }
}
