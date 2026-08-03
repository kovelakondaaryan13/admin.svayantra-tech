import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { commandCenterService } from "@/services/command-center-service";
import { generateRecommendations } from "@/ai/command-recommendations";

export const runtime = "nodejs";
export const maxDuration = 60;

/** AI recommendations over the live command-center picture (managers/owner). */
export async function POST() {
  try {
    const user = await requireUser();
    assertCan(user, "ai:chat");
    const cc = await commandCenterService.summary(user);
    return ok({ recommendations: await generateRecommendations(cc) });
  } catch (err) {
    return handleError(err);
  }
}
