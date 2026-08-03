import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { knowledgeService } from "@/services/knowledge-service";

export const runtime = "nodejs";

/** GET /api/knowledge/search?q=... — unified operational + knowledge search. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    assertCan(user, "knowledge:search");
    const q = new URL(req.url).searchParams.get("q") ?? "";
    return ok(await knowledgeService.search(user, q));
  } catch (err) {
    return handleError(err);
  }
}
