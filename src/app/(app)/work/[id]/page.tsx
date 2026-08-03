import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { leadService } from "@/services/lead-service";
import { taskService } from "@/services/task-service";
import { meetingService } from "@/services/meeting-service";
import { proposalService } from "@/services/proposal-service";
import { contactService } from "@/services/contact-service";
import { conveyorTeamService } from "@/services/conveyor-team-service";
import { playbookService } from "@/services/playbook-service";
import { employeeService } from "@/services/employee-service";
import { can } from "@/lib/iam";
import { NotFound } from "@/lib/errors";
import { fmtDate, fmtLakhCr } from "@/lib/format";
import { LeadIntelligence, LeadSummaryCard, LogTouch, LeadExecutionModel } from "@/components/work/lead-detail";
import { FileUploader } from "@/components/knowledge/file-uploader";
import { ObjectContext } from "@/components/context/object-context";
import {
  ObjectPage, Section, KpiRow, StatTile, Timeline, STAGE_BADGE,
  type ObjectActionItem, type BadgeVariant,
} from "@/components/ds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inr = (v?: { amountMinor: number }) => (v ? fmtLakhCr(v.amountMinor) : "—");
const STAGE_PROB: Record<string, number> = { new: 10, qualified: 25, meeting: 45, proposal: 65, negotiation: 82, won: 100, lost: 0 };

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  let lead;
  try {
    lead = await leadService.get(user, id);
  } catch (e) {
    if (e instanceof NotFound) notFound();
    throw e;
  }

  const [tasks, meetings, proposals, contacts, teams, playbooks, employees] = await Promise.all([
    taskService.list(user).then((t) => t.filter((x) => x.leadId === id)),
    meetingService.list(user).then((m) => m.filter((x) => x.leadId === id)),
    proposalService.list(user).then((p) => p.filter((x) => x.leadId === id)),
    lead.companyId
      ? contactService.list(user).then((c) => c.filter((x) => x.companyId === lead!.companyId))
      : Promise.resolve([]),
    conveyorTeamService.list(user).catch(() => []),
    playbookService.list(user).catch(() => []),
    can(user, "users.read") ? employeeService.list(user).catch(() => []) : Promise.resolve([]),
  ]);
  const nameByUser: Record<string, string> = {};
  for (const e of employees) nameByUser[e.userId] = e.name;
  const teamName = lead.conveyorTeamId ? teams.find((t) => t.id === lead.conveyorTeamId)?.name : undefined;

  const valMinor = lead.value?.amountMinor ?? 0;
  const prob = lead.probability ?? STAGE_PROB[lead.stage] ?? 0;
  const weighted = Math.round((valMinor * prob) / 100);

  const statuses: { label: string; variant: BadgeVariant }[] = [
    { label: lead.stage, variant: STAGE_BADGE[lead.stage] ?? "brand" },
    ...(lead.health ? [{ label: lead.health === "green" ? "on track" : lead.health === "red" ? "stalled" : "at risk", variant: (lead.health === "green" ? "success" : lead.health === "red" ? "danger" : "warning") as BadgeVariant }] : []),
    ...(lead.value ? [{ label: inr(lead.value), variant: "neutral" as BadgeVariant }] : []),
  ];

  const q = `the deal "${lead.name}"`;
  const actionBar: ObjectActionItem[] = [
    { label: "Advance stage", tier: "primary", intent: `Propose advancing ${q} to the next pipeline stage.`, intentKey: "advance_stage" },
    { label: "Generate proposal", intent: `Draft a proposal for ${q}.`, intentKey: "generate_proposal" },
    { label: "Add task", intent: `Create a task for ${q}: `, intentKey: "create_task" },
    { label: "Upload", tab: "knowledge" },
    ...(can(user, "sales.assign") ? [{ label: "Assign owner", tab: "work" } as ObjectActionItem] : []),
    { label: "Mark lost", tier: "more", danger: true, intent: `Mark ${q} as lost, and note the likely reason.`, intentKey: "mark_lost" },
  ];

  return (
    <ObjectPage
      kind="Deal"
      name={lead.name}
      logo="🎯"
      statuses={statuses}
      aiSummary={lead.aiSummary ?? `${lead.name}${lead.company ? ` · ${lead.company}` : ""} — ${lead.stage} stage, ${inr(lead.value)}. ${lead.touchCount ?? 0} touches; last ${lead.lastTouchAt ? fmtDate(lead.lastTouchAt) : "never"}.`}
      actions={<Link href="/work" className="btn-ghost text-xs">← Work</Link>}
      actionBar={actionBar}
      askAi={`Summarize everything about ${q} and tell me what to do next.`}
      objectRef={{ type: "lead", id }}
      tabs={[
        {
          key: "context",
          label: "Context",
          content: (
            <ObjectContext
              type="lead"
              id={id}
              aiSummary={lead.aiSummary}
              aiSummaryAt={lead.aiSummaryAt ? new Date(lead.aiSummaryAt).toISOString() : undefined}
              extras={
                <>
                  <Section title="Engagement" variant="plain">
                    <KpiRow>
                      <StatTile label="Value" value={inr(lead.value)} tone="brand" icon="💰" />
                      <StatTile label="Win probability" value={`${prob}%`} icon="📈" />
                      <StatTile label="Touches" value={String(lead.touchCount ?? 0)} icon="🤝" />
                      <StatTile label="Last touch" value={lead.lastTouchAt ? fmtDate(lead.lastTouchAt) : "never"} icon="⏰" />
                    </KpiRow>
                  </Section>
                  <Section title="Stakeholders">
                    {contacts.length === 0 && (lead.buyingCommittee ?? []).length === 0 ? (
                      <p className="px-1 py-2 text-sm text-muted">No stakeholders linked yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {contacts.map((c) => (
                          <div key={c.id} className="rounded-lg px-2 py-2 text-sm hover:bg-overlay/[0.03]">
                            <span className="text-fg">{c.name}</span> <span className="t-micro">{c.title ?? c.email ?? ""}</span>
                          </div>
                        ))}
                        {(lead.buyingCommittee ?? []).map((n, i) => (
                          <div key={`bc-${i}`} className="rounded-lg px-2 py-2 text-sm text-fg hover:bg-overlay/[0.03]">{n} <span className="t-micro">committee</span></div>
                        ))}
                      </div>
                    )}
                  </Section>
                  {proposals.length > 0 && (
                    <Section title={`Proposals (${proposals.length})`}>
                      <div className="space-y-1">
                        {proposals.map((p) => (
                          <div key={p.id} className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-overlay/[0.03]">
                            <span className="text-fg">{p.title}</span>
                            <span className="t-micro">{p.status} · {inr(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}
                  {lead.notes && <Section title="Notes"><p className="text-sm leading-relaxed text-fg/90">{lead.notes}</p></Section>}
                </>
              }
            />
          ),
        },
        {
          key: "work",
          label: "Work",
          content: (
            <div className="space-y-4">
              <LeadSummaryCard id={id} summary={lead.aiSummary} summaryAt={lead.aiSummaryAt ? new Date(lead.aiSummaryAt).toISOString() : undefined} />
              <Section title="Log a touch"><LogTouch id={id} /></Section>
              <Section title={`Tasks (${tasks.length})`}>
                {tasks.length === 0 ? <p className="px-1 py-2 text-sm text-muted">No tasks for this deal.</p> :
                  <div className="space-y-1">{tasks.map((t) => <div key={t.id} className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-overlay/[0.03]"><span className="text-fg">{t.title}</span><span className="t-micro">{t.priority ?? "task"} · {t.status}</span></div>)}</div>}
              </Section>
              <Section title={`Meetings (${meetings.length})`}>
                {meetings.length === 0 ? <p className="px-1 py-2 text-sm text-muted">No meetings yet.</p> :
                  <Timeline items={meetings.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()).map((m) => ({ id: m.id, title: m.title, time: fmtDate(m.at), tone: "neutral" as const }))} />}
              </Section>
              <LeadExecutionModel
                id={id}
                model={lead.executionModel}
                teamName={teamName}
                playbookKey={lead.playbookKey}
                stageDeadline={lead.stageDeadline ? new Date(lead.stageDeadline).toISOString() : undefined}
                currentOwnerName={lead.currentStageOwnerId ? nameByUser[lead.currentStageOwnerId] : undefined}
                history={(lead.ownerHistory ?? []).map((h) => ({ ownerName: nameByUser[h.ownerId] ?? "—", stage: h.stage, at: new Date(h.at).toISOString() }))}
                teams={teams.map((t) => ({ id: t.id, name: t.name }))}
                playbooks={playbooks.map((p) => ({ key: p.key, label: p.label, model: p.model }))}
                canManage={can(user, "sales.assign")}
              />
            </div>
          ),
        },
        {
          key: "knowledge",
          label: "Knowledge",
          content: <FileUploader related={{ type: "lead", id }} canWrite={can(user, "documents.write")} canDelete={can(user, "documents.delete")} />,
        },
        {
          key: "forecast",
          label: "Forecast",
          content: (
            <>
              <Section title="Forecast" variant="plain">
                <KpiRow>
                  <StatTile label="Deal value" value={inr(lead.value)} icon="💰" />
                  <StatTile label="Win probability" value={`${prob}%`} tone="brand" icon="📈" />
                  <StatTile label="Weighted" value={inr({ amountMinor: weighted })} tone="good" icon="🎯" />
                  <StatTile label="Est. close" value={lead.estimatedCloseAt ? fmtDate(lead.estimatedCloseAt) : "—"} icon="📅" />
                </KpiRow>
              </Section>
              <LeadIntelligence
                id={id}
                initial={{
                  score: lead.score, intentScore: lead.intentScore, health: lead.health, probability: lead.probability,
                  estimatedCloseAt: lead.estimatedCloseAt ? new Date(lead.estimatedCloseAt).toISOString() : undefined,
                  nextAction: lead.nextAction, painPoints: lead.painPoints, competitors: lead.competitors, buyingCommittee: lead.buyingCommittee,
                }}
              />
            </>
          ),
        },
      ]}
    />
  );
}
