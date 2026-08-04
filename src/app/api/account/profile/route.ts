import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { SelfProfileUpdateSchema } from "@/lib/schemas/admin";
import { employeeService } from "@/services/employee-service";

export const runtime = "nodejs";

/** The caller's own profile (name, personal email, phone). Self-service — no admin permission. */
export async function GET() {
  try {
    const user = await requireUser();
    return ok(await employeeService.getSelf(user));
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const patch = SelfProfileUpdateSchema.parse(await req.json());
    return ok(await employeeService.updateSelf(user, patch));
  } catch (err) {
    return handleError(err);
  }
}
