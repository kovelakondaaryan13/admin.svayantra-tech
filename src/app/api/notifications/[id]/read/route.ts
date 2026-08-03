import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { notificationService } from "@/services/notification-service";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    assertCan(user, "notification:read");
    await notificationService.markRead(user, (await params).id);
    return ok({ read: true });
  } catch (err) {
    return handleError(err);
  }
}
