import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { leadService } from "@/services/lead-service";

export const runtime = "nodejs";

const TouchSchema = z.object({
  channel: z.enum(["call", "email", "linkedin", "whatsapp", "meeting", "other"]),
  note: z.string().max(500).optional(),
});

/** Log an outbound touch on a lead (engagement + timeline). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    assertCan(user, "lead:update");
    const { id } = await params;
    const { channel, note } = TouchSchema.parse(await req.json());
    return ok(await leadService.logTouch(user, id, channel, note));
  } catch (err) {
    return handleError(err);
  }
}
