import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { EmployeeUpdateSchema } from "@/lib/schemas/admin";
import { employeeService } from "@/services/employee-service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    return ok(await employeeService.get(user, (await params).id));
  } catch (err) {
    return handleError(err);
  }
}

/** Update an employee — role/department/status. Role changes are audited. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const patch = EmployeeUpdateSchema.parse(await req.json());
    return ok(await employeeService.update(user, (await params).id, patch));
  } catch (err) {
    return handleError(err);
  }
}
