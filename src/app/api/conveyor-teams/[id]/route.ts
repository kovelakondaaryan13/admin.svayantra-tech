import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { conveyorTeamService } from "@/services/conveyor-team-service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

const UpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  memberUserIds: z.array(z.string().max(64)).max(50).optional(),
  playbookKey: z.string().max(60).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const input = UpdateSchema.parse(await req.json());
    return ok(await conveyorTeamService.update(user, (await params).id, input));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    await conveyorTeamService.remove(user, (await params).id);
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
