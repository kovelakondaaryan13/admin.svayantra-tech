import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { isOwner } from "@/lib/iam";
import { aiUsageService } from "@/services/ai-usage-service";
import { Forbidden } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    if (!isOwner(user)) throw new Forbidden("owner only");
    const url = new URL(req.url);
    const days = Math.min(Number(url.searchParams.get("days") ?? 30), 90);
    const data = await aiUsageService.summary(user, days);
    return ok(data);
  } catch (err) {
    return handleError(err);
  }
}
