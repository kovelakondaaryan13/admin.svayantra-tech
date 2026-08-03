import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { quotationService } from "@/services/quotation-service";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    assertCan(user, "quotation:approve"); // human approval gate
    return ok(await quotationService.approve(user, (await params).id));
  } catch (err) {
    return handleError(err);
  }
}
