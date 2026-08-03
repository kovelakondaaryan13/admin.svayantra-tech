import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { conveyorTeamService } from "@/services/conveyor-team-service";

export const runtime = "nodejs";

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  memberUserIds: z.array(z.string().max(64)).max(50),
  playbookKey: z.string().max(60).optional(),
});

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
