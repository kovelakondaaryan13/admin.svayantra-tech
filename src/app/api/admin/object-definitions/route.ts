import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { ObjectDefinitionSchema } from "@/lib/schemas/platform";
import { objectDefinitionService } from "@/services/object-definition-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await objectDefinitionService.list(user));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = ObjectDefinitionSchema.parse(await req.json());
    return ok(await objectDefinitionService.create(user, input), 201);
  } catch (err) {
    return handleError(err);
  }
}
