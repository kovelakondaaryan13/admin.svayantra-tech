import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertPermission } from "@/lib/iam";
import { ok, handleError } from "@/lib/http";
import { settingsService } from "@/services/settings-service";
import { OrgSettingsPatchSchema } from "@/lib/schemas/platform";

export const runtime = "nodejs";

/** Read org settings (org.manage required). */
export async function GET() {
  try {
    const user = await requireUser();
    assertPermission(user, "org.manage");
    const data = await settingsService.getOrg(user);
    return ok(data);
  } catch (err) {
    return handleError(err);
  }
}

/** Patch org settings (org.manage required). */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    assertPermission(user, "org.manage");
    const patch = OrgSettingsPatchSchema.parse(await req.json());
    const data = await settingsService.updateOrg(user, patch);
    return ok(data);
  } catch (err) {
    return handleError(err);
  }
}
