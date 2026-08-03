import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { conversationService } from "@/services/conversation-service";
import { chat } from "@/ai/orchestrator";
import { MODEL } from "@/ai/claude";
import { aiUsageService } from "@/services/ai-usage-service";

export const runtime = "nodejs";
export const maxDuration = 60;
type Params = { params: Promise<{ id: string }> };

const Schema = z.object({
  message: z.string().min(1).max(4000),
  attachments: z
    .array(z.object({ fileId: z.string().max(64), name: z.string().max(300), mimeType: z.string().max(120).optional(), documentId: z.string().max(64).optional() }))
    .max(10)
    .optional(),
});

/**
 * Send a message: persist the user turn, run the AI orchestrator (tools + approvals), persist the
 * assistant turn (with provider/model/latency — vendor-agnostic), return the reply. History
 * survives reloads. All persistence goes through ConversationService.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    assertCan(user, "ai:chat");
    const id = (await params).id;
    const { message, attachments } = Schema.parse(await req.json());

    await conversationService.append(user, id, { role: "user", content: message, attachments });
    // The conversation may be scoped to an object (opened via an Action Bar/⌘K intent) — give the
    // orchestrator that identity so it doesn't ask "which deal?" and can use the id in tool calls.
    const objectContext = await conversationService.objectsFor(user, id).catch(() => []);
    const t0 = Date.now();
    const result = await chat(user, message, { attachments, objectContext });
    await conversationService.append(user, id, {
      role: "assistant",
      content: result.text,
      provider: "anthropic",
      model: MODEL,
      latencyMs: Date.now() - t0,
    });

    if (result.usage) aiUsageService.record(user, result.usage.inputTokens, result.usage.outputTokens, MODEL);

    return ok({ text: result.text, pendingApprovals: result.pendingApprovals });
  } catch (err) {
    return handleError(err);
  }
}
