import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { AskSchema } from "@/lib/schemas/knowledge";
import { askKnowledge } from "@/services/knowledge-ask-service";

export const runtime = "nodejs";
export const maxDuration = 60;

/** RAG over company knowledge — retrieve (RBAC-filtered) → answer with citations. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    assertCan(user, "knowledge:ask");
    const { question, ...opts } = AskSchema.parse(await req.json());
    return ok(await askKnowledge(user, question, opts));
  } catch (err) {
    return handleError(err);
  }
}
