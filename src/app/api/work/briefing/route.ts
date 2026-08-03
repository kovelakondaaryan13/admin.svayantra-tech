import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { taskService } from "@/services/task-service";
import { meetingService } from "@/services/meeting-service";
import { metricsService } from "@/services/metrics-service";
import { can } from "@/lib/iam";
import { generateBriefing } from "@/ai/daily-briefing";

export const runtime = "nodejs";
export const maxDuration = 60;

/** AI-generated personalized daily work briefing for the current user. */
export async function POST(_req: NextRequest) {
  try {
    const user = await requireUser();
    assertCan(user, "ai:chat");

    const now = Date.now();
    const tasks = await taskService.listOpenForUser(user);
    const meetings = can(user, "calendar.read") ? await meetingService.list(user) : [];
    const metrics = can(user, "crm.read") ? await metricsService.summary(user).catch(() => null) : null;

    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const briefing = await generateBriefing({
      name: (user.name ?? user.email).split(/[ @]/)[0],
      openTasks: tasks.map((t) => ({
        title: t.title,
        priority: t.priority,
        dueAt: t.dueAt ? new Date(t.dueAt).toISOString() : undefined,
        overdue: !!t.dueAt && new Date(t.dueAt).getTime() < now,
      })),
      meetingsToday: meetings
        .filter((m) => { const at = new Date(m.at).getTime(); return at > now && at <= todayEnd.getTime(); })
        .map((m) => ({ title: m.title, at: new Date(m.at).toISOString() })),
      atRisk: (metrics?.atRisk ?? []).map((r) => ({ name: r.name, reason: r.reason })),
      pipelineNote: metrics
        ? `${metrics.totalLeads} leads, win rate ${metrics.winRate ?? "n/a"}%`
        : "no pipeline access",
    });

    return ok({ briefing });
  } catch (err) {
    return handleError(err);
  }
}
