/**
 * Organization memory: assembles "everything about X" from operational data + the
 * audit trail into one chronological, source-attributed dossier. This is the knowledge
 * graph the AI reasons over to answer questions like "when did negotiations begin?",
 * "who approved pricing?", or "what meetings happened before the quote?".
 */
import { db } from "@/lib/mongo";
import { leadService } from "@/services/lead-service";
import { taskService } from "@/services/task-service";
import { meetingService } from "@/services/meeting-service";
import { proposalService } from "@/services/proposal-service";
import { activityService } from "@/services/activity-service";
import type { Employee } from "@/lib/org-entities";
import type { AuditEntry } from "@/lib/types";
import type { User } from "@/lib/types";

export interface DossierEvent {
  type: "stage" | "activity" | "meeting" | "proposal" | "task" | "audit";
  at: string; // ISO
  summary: string;
  actor?: string;
}

export interface Dossier {
  found: boolean;
  lead?: {
    id: string; name: string; company?: string; stage: string;
    value?: string; source?: string; touchCount: number;
    health?: string; probability?: number; nextAction?: string;
  };
  proposals: { title: string; status: string; amount: string }[];
  timeline: DossierEvent[]; // chronological, oldest first
}

export const dossierService = {
  /** Build a dossier for the best lead match by name. */
  async forName(user: User, name: string): Promise<Dossier> {
    const matches = await leadService.search(user, name);
    const lead = matches[0];
    if (!lead) return { found: false, proposals: [], timeline: [] };

    const [tasks, meetings, proposals, activity, employees, auditRows] = await Promise.all([
      taskService.list(user).then((t) => t.filter((x) => x.leadId === lead.id)),
      meetingService.list(user).then((m) => m.filter((x) => x.leadId === lead.id)),
      proposalService.list(user).then((p) => p.filter((x) => x.leadId === lead.id)),
      activityService.listForEntity(user, "lead", lead.id),
      (await db()).collection<Employee>("employees").find({ orgId: user.orgId }).toArray(),
      (await db())
        .collection<AuditEntry>("auditLogs")
        .find({ orgId: user.orgId, entity: lead.id })
        .sort({ at: 1 })
        .limit(100)
        .toArray(),
    ]);

    const nameByUser = new Map(employees.map((e) => [e.userId, e.name]));
    const actorName = (actorId?: string) => {
      if (!actorId) return undefined;
      const ai = actorId.startsWith("ai:");
      const uid = ai ? actorId.slice(3) : actorId;
      const n = nameByUser.get(uid);
      return n ? (ai ? `${n} (via AI)` : n) : actorId;
    };
    const money = (m?: { amountMinor: number; currency: string }) =>
      m ? `${m.currency === "INR" ? "₹" : "$"}${(m.amountMinor / 100).toLocaleString("en-IN")}` : "—";

    const timeline: DossierEvent[] = [];
    for (const s of lead.stageHistory)
      timeline.push({ type: "stage", at: new Date(s.at).toISOString(), summary: `Stage ${s.from} → ${s.to}`, actor: actorName(s.actorId) });
    for (const a of activity)
      timeline.push({ type: "activity", at: new Date(a.createdAt).toISOString(), summary: a.summary, actor: actorName(a.actorId) });
    for (const m of meetings)
      timeline.push({ type: "meeting", at: new Date(m.at).toISOString(), summary: `Meeting: ${m.title}` });
    for (const p of proposals)
      timeline.push({ type: "proposal", at: new Date(p.createdAt).toISOString(), summary: `Proposal "${p.title}" (${p.status}, ${money(p.amount)})` });
    for (const t of tasks)
      timeline.push({ type: "task", at: new Date(t.createdAt).toISOString(), summary: `Task: ${t.title} [${t.status}]` });
    for (const r of auditRows)
      timeline.push({ type: "audit", at: new Date(r.at).toISOString(), summary: `${r.action}${r.meta ? ` ${JSON.stringify(r.meta)}` : ""}`, actor: actorName(r.actorId) });

    timeline.sort((a, b) => a.at.localeCompare(b.at));

    return {
      found: true,
      lead: {
        id: lead.id, name: lead.name, company: lead.company, stage: lead.stage,
        value: money(lead.value), source: lead.source, touchCount: lead.touchCount ?? 0,
        health: lead.health, probability: lead.probability, nextAction: lead.nextAction,
      },
      proposals: proposals.map((p) => ({ title: p.title, status: p.status, amount: money(p.amount) })),
      timeline,
    };
  },
};
