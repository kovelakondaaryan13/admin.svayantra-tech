import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { ObjectDefinitionUpdateSchema } from "@/lib/schemas/platform";
import { objectDefinitionService } from "@/services/object-definition-service";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const patch = ObjectDefinitionUpdateSchema.parse(await req.json());
    return ok(await objectDefinitionService.update(user, (await params).id, patch));
  } catch (err) {
    return handleError(err);
  }
}
