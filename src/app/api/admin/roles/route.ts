import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { RoleCreateSchema } from "@/lib/schemas/admin";
import { roleService } from "@/services/role-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await roleService.list(user));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = RoleCreateSchema.parse(await req.json());
    return ok(await roleService.create(user, input), 201);
  } catch (err) {
    return handleError(err);
  }
}
