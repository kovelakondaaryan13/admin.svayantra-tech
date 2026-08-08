import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertPermission } from "@/lib/iam";
import { ok, handleError } from "@/lib/http";
import { LeadBulkReassignSchema } from "@/lib/schemas/entities";
import { leadService } from "@/services/lead-service";

export const runtime = "nodejs";

/** Confirms an AI-proposed `bulk_reassign_leads` action (see src/ai/tools.ts). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    assertPermission(user, "crm.write");
    const { assignments } = LeadBulkReassignSchema.parse(await req.json());
    for (const a of assignments) await leadService.reassign(user, a.leadId, a.toUserId);
    return ok({ reassigned: assignments.length });
  } catch (err) {
    return handleError(err);
  }
}
