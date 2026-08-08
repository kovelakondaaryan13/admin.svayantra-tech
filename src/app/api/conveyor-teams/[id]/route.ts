import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { conveyorTeamService } from "@/services/conveyor-team-service";
import { ConveyorTeamUpdateSchema as UpdateSchema } from "@/lib/schemas/platform";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

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
