/**
 * Meeting preparation = retrieval + summarization, grounded in real data. Never
 * fabricates client facts. Guide: .claude/skills/sales/model-sales-features.md
 */
import { claude, MODEL } from "@/ai/claude";
import { leads } from "@/data/leads";
import { activityService } from "@/services/activity-service";
import { NotFound } from "@/lib/errors";
import type { User } from "@/lib/types";

type MeetingLike = { leadId?: string; title: string; at: Date; notes?: string };

export async function meetingPrep(user: User, meeting: MeetingLike): Promise<string> {
  const lead = meeting.leadId ? await leads.findById(user.orgId, meeting.leadId) : null;
  const timeline = meeting.leadId
    ? await activityService.listForEntity(user, "lead", meeting.leadId)
    : [];
  if (meeting.leadId && !lead) throw new NotFound("linked lead not found");

  const context = {
    meeting: { title: meeting.title, at: meeting.at, notes: meeting.notes },
    lead: lead
      ? { name: lead.name, company: lead.company, stage: lead.stage, notes: lead.notes }
      : null,
    recentActivity: timeline.slice(0, 10).map((a) => `${a.kind}: ${a.summary}`),
  };

  const res = await claude.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system:
      "You prepare a sales rep for a meeting. Use ONLY the provided context — never invent " +
      "facts about the client. Output: 1) one-line context, 2) 3 talking points, 3) 2 risks.",
    messages: [{ role: "user", content: JSON.stringify(context) }],
  });
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}
