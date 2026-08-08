import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { TaskAssignToRoleSchema } from "@/lib/schemas/entities";
import { taskService } from "@/services/task-service";

export const runtime = "nodejs";

/** Confirms an AI-proposed `assign_task_to_role` action (see src/ai/tools.ts). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    assertCan(user, "task:create");
    const { roleKey, ...input } = TaskAssignToRoleSchema.parse(await req.json());
    const count = await taskService.assignToRole(user, roleKey, input);
    return ok({ assigned: count }, 201);
  } catch (err) {
    return handleError(err);
  }
}
