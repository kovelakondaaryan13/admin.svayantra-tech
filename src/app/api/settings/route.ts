import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { settingsService } from "@/services/settings-service";

export const runtime = "nodejs";
const SettingsSchema = z.record(z.string(), z.unknown());

/** GET/PATCH /api/settings — the caller's own user preferences. */
export async function GET() {
  try {
    const user = await requireUser();
    assertCan(user, "settings:read");
    return ok(await settingsService.getUser(user));
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    assertCan(user, "settings:read"); // own prefs
    const patch = SettingsSchema.parse(await req.json());
    return ok(await settingsService.updateUser(user, patch));
  } catch (err) {
    return handleError(err);
  }
}
