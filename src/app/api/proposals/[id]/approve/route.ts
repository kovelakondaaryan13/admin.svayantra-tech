import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { proposalService } from "@/services/proposal-service";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    assertCan(user, "proposal:approve"); // human approval gate
    return ok(await proposalService.approve(user, (await params).id));
  } catch (err) {
    return handleError(err);
  }
}
