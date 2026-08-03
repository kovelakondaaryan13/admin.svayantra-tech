import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { meetingService } from "@/services/meeting-service";
import { meetingPrep } from "@/ai/prep";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    assertCan(user, "meeting:prep");
    const meeting = await meetingService.get(user, (await params).id);
    const brief = await meetingPrep(user, meeting);
    return ok({ brief });
  } catch (err) {
    return handleError(err);
  }
}
