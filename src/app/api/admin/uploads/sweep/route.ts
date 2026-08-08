import { requireUser } from "@/lib/auth";
import { assertPermission } from "@/lib/iam";
import { ok, handleError } from "@/lib/http";
import { uploadService } from "@/services/upload-service";

export const runtime = "nodejs";

/**
 * Manually-triggered cleanup of failed uploads past the configured retention window.
 * Callable from the admin settings page today; wire a Vercel Cron entry to this route
 * later for a fully automatic sweep — no code changes needed on that side.
 */
export async function POST() {
  try {
    const user = await requireUser();
    assertPermission(user, "documents.delete");
    return ok(await uploadService.sweepFailed(user));
  } catch (err) {
    return handleError(err);
  }
}
