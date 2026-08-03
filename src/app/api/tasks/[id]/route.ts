import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { TaskUpdateSchema } from "@/lib/schemas/entities";
import { taskService } from "@/services/task-service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    assertCan(user, "task:read");
    return ok(await taskService.get(user, (await params).id));
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    assertCan(user, "task:update");
    const input = TaskUpdateSchema.parse(await req.json());
    return ok(await taskService.update(user, (await params).id, input));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    assertCan(user, "task:delete");
    await taskService.remove(user, (await params).id);
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
