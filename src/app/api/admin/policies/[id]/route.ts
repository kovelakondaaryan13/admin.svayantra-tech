import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { PolicyUpdateSchema } from "@/lib/schemas/platform";
import { policyService } from "@/services/policy-service";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const patch = PolicyUpdateSchema.parse(await req.json());
    return ok(await policyService.update(user, (await params).id, patch));
  } catch (err) {
    return handleError(err);
  }
}
