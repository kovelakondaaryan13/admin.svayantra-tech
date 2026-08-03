import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { WorkflowDefinitionSchema } from "@/lib/schemas/platform";
import { workflowService } from "@/services/workflow-service";
import type { WorkflowNode } from "@/lib/platform/entities";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await workflowService.listDefinitions(user));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = WorkflowDefinitionSchema.parse(await req.json());
    return ok(
      await workflowService.createDefinition(user, {
        ...input,
        nodes: input.nodes as unknown as WorkflowNode[],
      }),
      201,
    );
  } catch (err) {
    return handleError(err);
  }
}
