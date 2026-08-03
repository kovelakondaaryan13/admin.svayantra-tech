import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { OrgUnitUpdateSchema } from "@/lib/schemas/platform";
import { orgUnitService } from "@/services/org-unit-service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const patch = OrgUnitUpdateSchema.parse(await req.json());
    return ok(await orgUnitService.update(user, (await params).id, patch));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    await orgUnitService.remove(user, (await params).id);
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
