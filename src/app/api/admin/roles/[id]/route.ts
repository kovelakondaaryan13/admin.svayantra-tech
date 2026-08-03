import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { RoleUpdateSchema } from "@/lib/schemas/admin";
import { roleService } from "@/services/role-service";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const patch = RoleUpdateSchema.parse(await req.json());
    return ok(await roleService.update(user, (await params).id, patch));
  } catch (err) {
    return handleError(err);
  }
}
