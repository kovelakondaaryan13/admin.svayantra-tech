import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { MeetingUpdateSchema } from "@/lib/schemas/entities";
import { meetingService } from "@/services/meeting-service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    assertCan(user, "meeting:read");
    return ok(await meetingService.get(user, (await params).id));
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    assertCan(user, "meeting:update");
    const patch = MeetingUpdateSchema.parse(await req.json());
    return ok(await meetingService.update(user, (await params).id, patch));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    assertCan(user, "meeting:delete");
    await meetingService.remove(user, (await params).id);
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
