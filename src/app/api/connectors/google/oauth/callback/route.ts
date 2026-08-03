import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { handleError } from "@/lib/http";
import { googleOAuth } from "@/lib/connectors/google/oauth";
import { verifyState } from "@/lib/connectors/oauth-state";
import { saveCredential } from "@/lib/connectors/credentials";
import { BusinessRule, Forbidden } from "@/lib/errors";

export const runtime = "nodejs";

/** OAuth redirect target: verify state (CSRF), exchange the code, store the sealed token. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const error = url.searchParams.get("error");
    if (error) return NextResponse.redirect(new URL(`/connectors?error=${encodeURIComponent(error)}`, req.url));

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) throw new BusinessRule("missing code or state");

    const payload = verifyState<{ userId: string; ts: number }>(state);
    if (!payload || payload.userId !== user.id || Date.now() - payload.ts > 600_000) {
      throw new Forbidden("invalid or expired OAuth state");
    }

    const bundle = await googleOAuth.exchangeCode(code);
    await saveCredential(user, "google_calendar", bundle); // sealed at rest
    return NextResponse.redirect(new URL("/connectors?connected=google_calendar", req.url));
  } catch (err) {
    return handleError(err);
  }
}
