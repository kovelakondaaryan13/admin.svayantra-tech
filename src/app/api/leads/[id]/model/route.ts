import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { leadService } from "@/services/lead-service";

export const runtime = "nodejs";

const ModelSchema = z.object({
  model: z.enum(["individual", "conveyor"]),
  conveyorTeamId: z.string().max(64).optional(),
  playbookKey: z.string().max(60).optional(),
});

/** Set/switch a lead's sales execution model (Individual Funnel vs Conveyor Belt). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    assertCan(user, "lead:update");
    const { id } = await params;
    const input = ModelSchema.parse(await req.json());
    return ok(await leadService.setExecutionModel(user, id, input));
  } catch (err) {
    return handleError(err);
  }
}
