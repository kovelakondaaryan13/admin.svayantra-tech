import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { conversationService } from "@/services/conversation-service";

export const runtime = "nodejs";

const CreateSchema = z.object({
  firstMessage: z.string().max(4000).optional(),
  title: z.string().max(160).optional(),
  intentKey: z.string().max(40).optional(),
  relatedObject: z
    .object({
      type: z.enum(["company", "person", "lead", "meeting", "document"]),
      id: z.string().max(64),
      label: z.string().max(160).optional(),
    })
    .optional(),
});

/** List the caller's conversations. Supports `?q=` text search + `?archived=1`. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    assertCan(user, "ai:chat");
    const url = new URL(req.url);
    const q = url.searchParams.get("q") ?? undefined;
    const includeArchived = url.searchParams.get("archived") === "1";
    return ok(await conversationService.list(user, { q, includeArchived }));
  } catch (err) {
    return handleError(err);
  }
}

/** Start a new conversation. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    assertCan(user, "ai:chat");
    const { firstMessage, title, intentKey, relatedObject } = CreateSchema.parse(await req.json().catch(() => ({})));
    return ok(await conversationService.create(user, { firstMessage, title, intentKey, relatedObject }), 201);
  } catch (err) {
    return handleError(err);
  }
}
