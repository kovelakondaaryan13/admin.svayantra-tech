import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { leadService } from "@/services/lead-service";
import { taskService } from "@/services/task-service";
import { meetingService } from "@/services/meeting-service";
import { proposalService } from "@/services/proposal-service";
import { activityService } from "@/services/activity-service";
import { summarizeLead } from "@/ai/summarize-lead";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Generate + persist an AI intelligence summary for one lead. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    assertCan(user, "ai:chat");
    assertCan(user, "lead:read");
    const { id } = await params;

    const lead = await leadService.get(user, id);
    const [tasks, meetings, proposals, activity] = await Promise.all([
      taskService.list(user),
      meetingService.list(user),
      proposalService.list(user),
      activityService.listForEntity(user, "lead", id),
    ]);

    const valueLabel = lead.value
      ? `${lead.value.currency} ${(lead.value.amountMinor / 100).toLocaleString("en-IN")}`
      : undefined;

    const result = await summarizeLead({
      name: lead.name,
      company: lead.company,
      stage: lead.stage,
      valueLabel,
      notes: lead.notes,
      stageHistory: lead.stageHistory.map((s) => ({
        from: s.from,
        to: s.to,
        at: new Date(s.at).toISOString(),
      })),
      tasks: tasks.filter((t) => t.leadId === id).map((t) => ({ title: t.title, status: t.status })),
      meetings: meetings
        .filter((m) => m.leadId === id)
        .map((m) => ({ title: m.title, at: new Date(m.at).toISOString() })),
      activity: activity.map((a) => ({ summary: a.summary, kind: a.kind })),
      proposals: proposals
        .filter((p) => p.leadId === id)
        .map((p) => ({ title: p.title, status: p.status })),
    });

    return ok(await leadService.saveSummary(user, id, result));
  } catch (err) {
    return handleError(err);
  }
}
