import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { TaskCreateSchema } from "@/lib/schemas/entities";
import { taskService } from "@/services/task-service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    assertCan(user, "task:read");
    const scope = new URL(req.url).searchParams.get("scope");
    if (scope === "mine" || scope === "team" || scope === "all") {
      return ok(await taskService.listScoped(user, scope));
    }
    return ok(await taskService.list(user));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    assertCan(user, "task:create");
    const input = TaskCreateSchema.parse(await req.json());
    return ok(await taskService.create(user, input), 201);
  } catch (err) {
    return handleError(err);
  }
}
