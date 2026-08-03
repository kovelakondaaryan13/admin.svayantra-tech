import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { handleError } from "@/lib/http";
import { conversationService } from "@/services/conversation-service";
import { chat, type StreamEvent } from "@/ai/orchestrator";
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

export async function POST(req: NextRequest, { params }: Params) {
  // Auth + validation happen BEFORE the stream starts, so a 401/403/422 is a real HTTP
  // status the caller can check — once the SSE stream begins, headers are already sent
  // and only an in-stream {type:"error"} frame is possible for failures after this point.
  let user, id, message, attachments;
  try {
    user = await requireUser();
    id = (await params).id;
    ({ message, attachments } = Schema.parse(await req.json()));
  } catch (err) {
    return handleError(err);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch { /* controller closed */ }
      };

      try {
        await conversationService.append(user, id, { role: "user", content: message, attachments });
        const objectContext = await conversationService.objectsFor(user, id).catch(() => []);

        const t0 = Date.now();
        const result = await chat(user, message, {
          attachments,
          objectContext,
          onEvent: send,
        });

        await conversationService.append(user, id, {
          role: "assistant",
          content: result.text,
          provider: "anthropic",
          model: MODEL,
          latencyMs: Date.now() - t0,
        });

        if (result.usage) aiUsageService.record(user, result.usage.inputTokens, result.usage.outputTokens, MODEL);

        send({ type: "done", text: result.text, pendingApprovals: result.pendingApprovals });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Internal error" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
