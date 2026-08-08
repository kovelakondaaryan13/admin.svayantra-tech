import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { conveyorTeamService } from "@/services/conveyor-team-service";
import { ConveyorTeamCreateSchema as CreateSchema } from "@/lib/schemas/platform";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await conveyorTeamService.list(user));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = CreateSchema.parse(await req.json());
    return ok(await conveyorTeamService.create(user, input), 201);
  } catch (err) {
    return handleError(err);
  }
}
