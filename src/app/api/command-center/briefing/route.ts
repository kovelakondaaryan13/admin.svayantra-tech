import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { can } from "@/lib/iam";
import { ok, handleError } from "@/lib/http";
import { commandCenterService } from "@/services/command-center-service";
import { meetingService } from "@/services/meeting-service";
import { generateExecutiveBriefing } from "@/ai/executive-briefing";

export const runtime = "nodejs";
export const maxDuration = 60;

/** AI executive morning briefing over the live command-center picture (managers/owner). */
export async function POST() {
  try {
    const user = await requireUser();
    assertCan(user, "ai:chat");
    const cc = await commandCenterService.summary(user);
    const now = Date.now();
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const meetings = can(user, "calendar.read") ? await meetingService.list(user).catch(() => []) : [];
    const today = meetings
      .filter((m) => { const t = new Date(m.at).getTime(); return t >= now && t <= end.getTime(); })
      .map((m) => `${m.title} @ ${new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
    const name = (user.name ?? user.email).split(/[ @]/)[0];
    return ok({ briefing: await generateExecutiveBriefing(name, cc, today) });
  } catch (err) {
    return handleError(err);
  }
}
