import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { chat } from "@/ai/orchestrator";

export const runtime = "nodejs";
// AI + tool loop can take a while; give the function headroom on Vercel.
export const maxDuration = 60;

const ChatSchema = z.object({ message: z.string().min(1).max(4000) });

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    assertCan(user, "ai:chat");
    const { message } = ChatSchema.parse(await req.json());
    const result = await chat(user, message);
    return ok(result);
  } catch (err) {
    return handleError(err);
  }
}
