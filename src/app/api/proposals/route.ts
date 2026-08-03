import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { ProposalCreateSchema } from "@/lib/schemas/entities";
import { proposalService } from "@/services/proposal-service";

export const runtime = "nodejs";
export const maxDuration = 60; // AI drafting may run when aiDraft=true

export async function GET() {
  try {
    const user = await requireUser();
    assertCan(user, "proposal:read");
    return ok(await proposalService.list(user));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    assertCan(user, "proposal:create");
    const input = ProposalCreateSchema.parse(await req.json());
    return ok(await proposalService.create(user, input), 201);
  } catch (err) {
    return handleError(err);
  }
}
