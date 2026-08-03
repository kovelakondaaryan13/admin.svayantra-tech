import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { taskService } from "@/services/task-service";

export const runtime = "nodejs";

/** Toggle whether the current user follows (watches) this task. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    assertCan(user, "task:read");
    const { id } = await params;
    return ok(await taskService.toggleFollower(user, id));
  } catch (err) {
    return handleError(err);
  }
}
