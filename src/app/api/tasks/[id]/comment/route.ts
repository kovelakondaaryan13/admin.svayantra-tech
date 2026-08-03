import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { taskService } from "@/services/task-service";

export const runtime = "nodejs";

const CommentSchema = z.object({ text: z.string().min(1).max(2000) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    assertCan(user, "task:update");
    const { id } = await params;
    const { text } = CommentSchema.parse(await req.json());
    return ok(await taskService.addComment(user, id, text));
  } catch (err) {
    return handleError(err);
  }
}
