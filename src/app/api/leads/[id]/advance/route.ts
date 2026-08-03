import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { StageChangeSchema } from "@/lib/schemas/lead";
import { leadService } from "@/services/lead-service";
import type { LeadStage } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    assertCan(user, "lead:advance");
    const { id } = await params;
    const { to } = StageChangeSchema.parse(await req.json());
    const lead = await leadService.advance(id, to as LeadStage, { user });
    return ok(lead);
  } catch (err) {
    return handleError(err);
  }
}
