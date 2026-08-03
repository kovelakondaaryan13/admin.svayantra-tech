import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { MeetingCreateSchema } from "@/lib/schemas/entities";
import { meetingService } from "@/services/meeting-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    assertCan(user, "meeting:read");
    return ok(await meetingService.list(user));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    assertCan(user, "meeting:create");
    const input = MeetingCreateSchema.parse(await req.json());
    return ok(await meetingService.create(user, input), 201);
  } catch (err) {
    return handleError(err);
  }
}
