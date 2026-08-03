import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { WorkflowStartSchema } from "@/lib/schemas/platform";
import { workflowService } from "@/services/workflow-service";

export const runtime = "nodejs";

/** Start a configured workflow instance (e.g. a quotation approval). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { workflowKey, context, subject } = WorkflowStartSchema.parse(await req.json());
    return ok(await workflowService.start(user, workflowKey, context, subject), 201);
  } catch (err) {
    return handleError(err);
  }
}
