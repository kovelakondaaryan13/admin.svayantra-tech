import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { PolicyCreateSchema } from "@/lib/schemas/platform";
import { policyService } from "@/services/policy-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await policyService.list(user));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = PolicyCreateSchema.parse(await req.json());
    return ok(await policyService.create(user, input), 201);
  } catch (err) {
    return handleError(err);
  }
}
