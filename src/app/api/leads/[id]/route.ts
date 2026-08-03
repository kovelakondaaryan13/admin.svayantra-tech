import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { LeadUpdateSchema } from "@/lib/schemas/lead";
import { leadService } from "@/services/lead-service";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    assertCan(user, "lead:read");
    const { id } = await params;
    return ok(await leadService.get(user, id));
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    assertCan(user, "lead:update");
    const { id } = await params;
    const patch = LeadUpdateSchema.parse(await req.json());
    return ok(await leadService.update(user, id, patch));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    assertCan(user, "lead:delete");
    const { id } = await params;
    await leadService.remove(user, id);
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
