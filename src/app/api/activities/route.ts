import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { activityService } from "@/services/activity-service";
import type { Activity } from "@/lib/entities";

export const runtime = "nodejs";

/**
 * GET /api/activities?entityType=lead&entityId=... → timeline for one entity.
 * GET /api/activities (no params) → recent org activity feed.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    assertCan(user, "activity:read");
    const { searchParams } = new URL(req.url);
    const entityType = searchParams.get("entityType") as Activity["entityType"] | null;
    const entityId = searchParams.get("entityId");
    if (entityType && entityId) {
      return ok(await activityService.listForEntity(user, entityType, entityId));
    }
    return ok(await activityService.recent(user));
  } catch (err) {
    return handleError(err);
  }
}
