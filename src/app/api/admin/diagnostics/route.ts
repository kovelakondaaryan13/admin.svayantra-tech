import { requireUser } from "@/lib/auth";
import { isOwner } from "@/lib/iam";
import { ok, handleError } from "@/lib/http";
import { Forbidden } from "@/lib/errors";
import { summary } from "@/lib/telemetry";

export const runtime = "nodejs";

/** Diagnostics summary — owner only (for the team building STOS, not end users). */
export async function GET() {
  try {
    const user = await requireUser();
    if (!isOwner(user)) throw new Forbidden("owner only");
    return ok(await summary());
  } catch (err) {
    return handleError(err);
  }
}
