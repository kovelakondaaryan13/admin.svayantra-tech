import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { isOwner } from "@/lib/iam";
import { ok, handleError } from "@/lib/http";
import { Forbidden } from "@/lib/errors";
import { getOrgMode, setOrgMode } from "@/lib/mode";

export const runtime = "nodejs";

const ModeSchema = z.object({ mode: z.enum(["demo", "production"]) });

/** Read the org operating mode (any member). */
export async function GET() {
  try {
    const user = await requireUser();
    return ok({ mode: await getOrgMode(user.orgId) });
  } catch (err) {
    return handleError(err);
  }
}

/** Switch Demo ⇄ Production (owner only). */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!isOwner(user)) throw new Forbidden("only the owner can change the operating mode");
    const { mode } = ModeSchema.parse(await req.json());
    await setOrgMode(user.orgId, mode);
    return ok({ mode });
  } catch (err) {
    return handleError(err);
  }
}
