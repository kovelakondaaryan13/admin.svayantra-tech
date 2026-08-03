import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { WorkflowActSchema } from "@/lib/schemas/platform";
import { workflowService } from "@/services/workflow-service";

export const runtime = "nodejs";

/** Approve/reject the pending step of a workflow instance (designated approver only). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { decision, note } = WorkflowActSchema.parse(await req.json());
    return ok(await workflowService.act(user, (await params).id, decision, note));
  } catch (err) {
    return handleError(err);
  }
}
