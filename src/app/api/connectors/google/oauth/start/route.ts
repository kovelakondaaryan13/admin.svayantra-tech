import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { handleError } from "@/lib/http";
import { googleOAuth } from "@/lib/connectors/google/oauth";
import { signState } from "@/lib/connectors/oauth-state";
import { BusinessRule } from "@/lib/errors";

export const runtime = "nodejs";

/** Begin Google OAuth: redirect the user to Google's consent screen. */
export async function GET() {
  try {
    const user = await requireUser();
    // Personal connection (credential is scoped to this user), not an org-wide integration
    // setting — gate on calendar:write (same permission the sync feature itself requires),
    // not connector:manage (admin-only), or non-admin reps could never connect their own calendar.
    assertCan(user, "calendar:write");
    if (!googleOAuth.isConfigured()) {
      throw new BusinessRule("Google connector not configured (set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)");
    }
    const state = signState({ userId: user.id, ts: Date.now() });
    return NextResponse.redirect(googleOAuth.authUrl(state));
  } catch (err) {
    return handleError(err);
  }
}
