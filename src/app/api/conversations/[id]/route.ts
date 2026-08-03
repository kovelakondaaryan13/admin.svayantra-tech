import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { conversationService } from "@/services/conversation-service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  pinned: z.boolean().optional(),
  archived: z.boolean().optional(),
  attach: z.object({
    type: z.enum(["company", "person", "lead", "meeting", "document"]),
    id: z.string().max(64),
    label: z.string().max(200).optional(),
  }).optional(),
});

/** A conversation + its full message history. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    assertCan(user, "ai:chat");
    return ok(await conversationService.get(user, (await params).id));
  } catch (err) {
    return handleError(err);
  }
}

/** Rename / pin / archive / attach a related object. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    assertCan(user, "ai:chat");
    const id = (await params).id;
    const p = PatchSchema.parse(await req.json());
    if (p.title !== undefined) await conversationService.rename(user, id, p.title);
    if (p.pinned !== undefined || p.archived !== undefined) {
      await conversationService.setFlags(user, id, { pinned: p.pinned, archived: p.archived });
    }
    if (p.attach) await conversationService.attachObject(user, id, p.attach);
    return ok({ updated: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    assertCan(user, "ai:chat");
    await conversationService.remove(user, (await params).id);
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
