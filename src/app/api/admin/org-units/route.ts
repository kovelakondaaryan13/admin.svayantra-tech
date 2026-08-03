import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { OrgUnitCreateSchema } from "@/lib/schemas/platform";
import { orgUnitService } from "@/services/org-unit-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await orgUnitService.list(user));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = OrgUnitCreateSchema.parse(await req.json());
    return ok(await orgUnitService.create(user, input), 201);
  } catch (err) {
    return handleError(err);
  }
}
