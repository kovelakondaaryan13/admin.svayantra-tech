import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { assertPermission } from "@/lib/iam";
import { ok, handleError } from "@/lib/http";
import { getUploadRetentionDays, setUploadRetentionDays } from "@/lib/upload-retention";

export const runtime = "nodejs";

const RetentionSchema = z.object({ days: z.number().int().min(1).max(365) });

/** Read the configured failed-upload retention window (default 7 days). */
export async function GET() {
  try {
    const user = await requireUser();
    assertPermission(user, "org.manage");
    return ok({ days: await getUploadRetentionDays(user.orgId) });
  } catch (err) {
    return handleError(err);
  }
}

/** Configure how long a failed upload is kept before it's eligible for cleanup. */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    assertPermission(user, "org.manage");
    const { days } = RetentionSchema.parse(await req.json());
    await setUploadRetentionDays(user.orgId, days);
    return ok({ days });
  } catch (err) {
    return handleError(err);
  }
}
