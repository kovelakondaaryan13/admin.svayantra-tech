import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { OverridesSchema } from "@/lib/schemas/admin";
import { employeeService } from "@/services/employee-service";
import { permissionService } from "@/services/permission-service";

export const runtime = "nodejs";

/** Set per-user permission grant/deny overrides (requires `roles.manage`). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const employee = await employeeService.get(user, (await params).id);
    const { grants, denies } = OverridesSchema.parse(await req.json());
    await permissionService.setOverrides(user, employee.userId, grants, denies);
    return ok({ updated: true });
  } catch (err) {
    return handleError(err);
  }
}
