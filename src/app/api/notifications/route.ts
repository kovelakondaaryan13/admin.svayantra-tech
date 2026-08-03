import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { notificationService } from "@/services/notification-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    assertCan(user, "notification:read");
    return ok(await notificationService.listForUser(user));
  } catch (err) {
    return handleError(err);
  }
}
