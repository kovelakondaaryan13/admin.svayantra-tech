import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/iam";
import { companyService } from "@/services/company-service";
import { contactService } from "@/services/contact-service";
import { leadService } from "@/services/lead-service";
import { meetingService } from "@/services/meeting-service";
import { documentService } from "@/services/document-service";
import { activityService } from "@/services/activity-service";
import { taskService } from "@/services/task-service";
import { proposalService } from "@/services/proposal-service";
import { quotationService } from "@/services/quotation-service";
import { fmtLakhCr as inr, fmtRelativeTime } from "@/lib/format";
import {
  ObjectPage, Section, KpiRow, StatTile, Badge, Avatar, STAGE_BADGE,
  type ObjectActionItem, type BadgeVariant,
} from "@/components/ds";
import { FileUploader } from "@/components/knowledge/file-uploader";
import { ObjectContext } from "@/components/context/object-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPEN = ["new", "qualified", "meeting", "proposal", "negotiation"];
const relTime = (d: Date | string) => fmtRelativeTime(d, { granularity: "day", suffix: " ago", zeroLabel: "today" });

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "crm.read")) redirect("/home");
  const { id } = await params;

  const company = await companyService.get(user, id).catch(() => null);
  if (!company) redirect("/companies");

  const [contacts, allLeads, allDocs, allMeetings, companyActs, allTasks, allProposals, allQuotations] = await Promise.all([
    contactService.list(user).catch(() => []),
    leadService.list(user).catch(() => []),
    documentService.list(user).catch(() => []),
    meetingService.list(user).catch(() => []),
    activityService.listForEntity(user, "company", id).catch(() => []),
    taskService.list(user).catch(() => []),
    proposalService.list(user).catch(() => []),
    quotationService.list(user).catch(() => []),
  ]);

  // Fall back to name-matching only for legacy leads created before companyId was
  // stamped at creation time — new leads always carry companyId (see lead-service.create).
  const deals = allLeads.filter((l) => l.companyId === id || (company.name && l.company === company.name));
  const people = contacts.filter((c) => c.companyId === id);
  const docs = allDocs.filter((d) => d.companyId === id);
  const dealIds = new Set(deals.map((d) => d.id));
  const contactIds = new Set(people.map((c) => c.id));
  const meetings = allMeetings.filter((m) => m.companyId === id || (m.leadId && dealIds.has(m.leadId)) || (m.contactId && contactIds.has(m.contactId)));
  const tasks = allTasks.filter((t) => t.companyId === id || (t.leadId && dealIds.has(t.leadId)));
  const proposals = allProposals.filter((p) => dealIds.has(p.leadId));
  const quotations = allQuotations.filter((q) => dealIds.has(q.leadId));

  const now = Date.now();
  const openTasks = tasks.filter((t) => t.status === "open").sort((a, z) => {
    const at = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
    const zt = z.dueAt ? new Date(z.dueAt).getTime() : Infinity;
    return at - zt;
  });
  const upcomingMeetings = meetings.filter((m) => new Date(m.at).getTime() > now).sort((a, z) => new Date(a.at).getTime() - new Date(z.at).getTime());
  const pendingProposals = proposals.filter((p) => p.status !== "approved");
  const outstandingQuotations = quotations.filter((q) => q.status !== "approved");

  const dealActs = (await Promise.all(deals.map((d) => activityService.listForEntity(user, "lead", d.id).catch(() => []))))
    .flat();
  const acts = [...companyActs, ...dealActs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const won = deals.filter((d) => d.stage === "won");
  const wonMinor = won.reduce((s, d) => s + (d.value?.amountMinor ?? 0), 0);
  const pipelineMinor = deals.filter((d) => OPEN.includes(d.stage)).reduce((s, d) => s + (d.value?.amountMinor ?? 0), 0);
  const hasRed = deals.some((d) => OPEN.includes(d.stage) && d.health === "red");
  const health: { label: string; variant: BadgeVariant } = won.length && !hasRed
    ? { label: "Client · healthy", variant: "success" }
    : hasRed
    ? { label: "At risk", variant: "danger" }
    : { label: deals.length ? "Active prospect" : "New", variant: "brand" };

  const summary = `${company.name}${company.industry ? ` — ${company.industry}` : ""}${
    company.revenueEstimate ? `, ${company.revenueEstimate} est. revenue` : ""
  }. ${deals.length} opportunit${deals.length === 1 ? "y" : "ies"} · ${inr(pipelineMinor)} in pipeline${
    wonMinor ? ` · ${inr(wonMinor)} won` : ""
  }. ${people.length} contact${people.length === 1 ? "" : "s"}.${
    acts[0] ? ` Last activity ${relTime(acts[0].createdAt)}.` : ""
  }`;

  const q = company.name;
  const actionBar: ObjectActionItem[] = [
    { label: "Create deal", tier: "primary", intent: `Create a new deal for ${q}: `, intentKey: "create_deal" },
    { label: "Upload", tab: "knowledge" },
    { label: "Add contact", intent: `Add a contact at ${q}: `, intentKey: "add_contact" },
    { label: "Schedule meeting", intent: `Schedule a meeting with ${q}.`, intentKey: "schedule_meeting" },
  ];

  return (
    <ObjectPage
      kind="Company"
      name={company.name}
      logo="🏢"
      statuses={[
        health,
        ...(company.industry ? [{ label: company.industry, variant: "neutral" as BadgeVariant }] : []),
        ...(company.revenueEstimate ? [{ label: company.revenueEstimate, variant: "neutral" as BadgeVariant }] : []),
      ]}
      aiSummary={summary}
      actions={<Link href="/companies" className="btn-ghost text-xs">← All companies</Link>}
      actionBar={actionBar}
      askAi={`Summarize everything about ${q} and what I should do next.`}
      objectRef={{ type: "company", id }}
      tabs={[
        {
          key: "context",
          label: "Context",
          content: (
            <ObjectContext
              type="company"
              id={id}
              aiSummary={summary}
              extras={
                <>
                  <Section title="Upcoming work" action={<span className="t-micro">everything filtered to this company</span>}>
                    {openTasks.length === 0 && upcomingMeetings.length === 0 && pendingProposals.length === 0 && outstandingQuotations.length === 0 ? (
                      <p className="px-1 py-2 text-sm text-muted">Nothing outstanding — no open tasks, meetings, proposals, or quotations.</p>
                    ) : (
                      <div className="space-y-3">
                        {openTasks.length > 0 && (
                          <div>
                            <div className="t-micro mb-1">Upcoming tasks ({openTasks.length})</div>
                            <div className="space-y-1">
                              {openTasks.slice(0, 5).map((t) => (
                                <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-overlay/[0.03]">
                                  <span className="min-w-0 flex-1 truncate text-fg">{t.title}</span>
                                  <span className="shrink-0 text-xs text-muted">{t.dueAt ? new Date(t.dueAt).toLocaleDateString() : "no due date"}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {upcomingMeetings.length > 0 && (
                          <div>
                            <div className="t-micro mb-1">Upcoming meetings ({upcomingMeetings.length})</div>
                            <div className="space-y-1">
                              {upcomingMeetings.slice(0, 5).map((m) => (
                                <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-overlay/[0.03]">
                                  <span className="min-w-0 flex-1 truncate text-fg">{m.title}</span>
                                  <span className="shrink-0 text-xs text-muted">{new Date(m.at).toLocaleDateString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {pendingProposals.length > 0 && (
                          <div>
                            <div className="t-micro mb-1">Pending proposal ({pendingProposals.length})</div>
                            <div className="space-y-1">
                              {pendingProposals.slice(0, 3).map((p) => (
                                <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-overlay/[0.03]">
                                  <span className="min-w-0 flex-1 truncate text-fg">{p.title}</span>
                                  <Badge variant="warning">{p.status.replace(/_/g, " ")}</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {outstandingQuotations.length > 0 && (
                          <div>
                            <div className="t-micro mb-1">Outstanding quotation ({outstandingQuotations.length})</div>
                            <div className="space-y-1">
                              {outstandingQuotations.slice(0, 3).map((qn) => (
                                <div key={qn.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-overlay/[0.03]">
                                  <span className="text-fg">{inr(qn.totalMinor)}</span>
                                  <Badge variant="warning">{qn.status.replace(/_/g, " ")}</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </Section>
                  <Section title={`People (${people.length})`}>
                    {people.length === 0 ? (
                      <p className="px-1 py-2 text-sm text-muted">No contacts linked yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {people.map((c) => (
                          <div key={c.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-overlay/[0.03]">
                            <Avatar name={c.name} size="sm" />
                            <div className="min-w-0">
                              <div className="text-sm text-fg">{c.name}</div>
                              <div className="t-micro">{c.title ? `${c.title} · ` : ""}{c.email ?? ""}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Section>
                </>
              }
            />
          ),
        },
        {
          key: "work",
          label: "Work",
          content: (
            <>
              <Section title={`Opportunities (${deals.length})`}>
                {deals.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-muted">No deals for this company yet.</p>
                ) : (
                  <div className="space-y-1">
                    {deals.map((d) => (
                      <Link key={d.id} href={`/work/${d.id}`} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-overlay/[0.03]">
                        <span className="flex min-w-0 items-center gap-2">
                          <Badge variant={STAGE_BADGE[d.stage] ?? "neutral"}>{d.stage}</Badge>
                          <span className="truncate text-sm text-fg">{d.name}</span>
                        </span>
                        <span className="shrink-0 text-sm text-muted">{d.value ? inr(d.value.amountMinor) : "—"}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </Section>
              <Section title={`Meeting history (${meetings.length})`}>
                {meetings.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-muted">No meetings yet.</p>
                ) : (
                  <div className="space-y-2">
                    {[...meetings]
                      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
                      .map((m) => (
                        <div key={m.id} className="rounded-lg border border-border/60 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-fg">{m.title}</span>
                            <span className="shrink-0 text-xs text-muted">{new Date(m.at).toLocaleDateString()}</span>
                          </div>
                          {m.attendees && m.attendees.length > 0 && (
                            <p className="t-micro mt-1">Attendees: {m.attendees.join(", ")}</p>
                          )}
                          {m.summary && <p className="mt-1 text-sm text-fg/90">{m.summary}</p>}
                          {m.actionItems && m.actionItems.length > 0 && (
                            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-fg/90">
                              {m.actionItems.map((a, i) => <li key={i}>{a}</li>)}
                            </ul>
                          )}
                          {m.transcript && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-xs text-muted hover:text-fg">Transcript</summary>
                              <p className="mt-1 whitespace-pre-wrap text-xs text-fg/80">{m.transcript}</p>
                            </details>
                          )}
                          {!m.summary && !m.actionItems?.length && !m.attendees?.length && !m.transcript && (
                            <p className="t-micro mt-1">No notes recorded for this meeting.</p>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </Section>
            </>
          ),
        },
        {
          key: "knowledge",
          label: "Knowledge",
          content: (
            <>
              <FileUploader related={{ type: "company", id }} canWrite={can(user, "documents.write")} canDelete={can(user, "documents.delete")} />
              <Section title={`Documents (${docs.length})`}>
                {docs.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-muted">No documents linked to this company.</p>
                ) : (
                  <div className="space-y-1">
                    {docs.map((d) => (
                      <div key={d.id} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-fg/90 hover:bg-overlay/[0.03]">
                        <span>📄</span>{d.title}<Badge variant="neutral">{d.documentType}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </>
          ),
        },
        {
          key: "insights",
          label: "Insights",
          content: (
            <>
              <Section title="Financial context" variant="plain">
                <KpiRow>
                  <StatTile label="Open deals" value={String(deals.filter((d) => OPEN.includes(d.stage)).length)} icon="🎯" />
                  <StatTile label="Pipeline" value={inr(pipelineMinor)} tone="brand" icon="📈" />
                  <StatTile label="Won (LTV)" value={inr(wonMinor)} tone="good" icon="💰" />
                  <StatTile label="Contacts" value={String(people.length)} icon="👥" />
                </KpiRow>
              </Section>
              <Section title="Relationship health">
                <div className="flex items-center gap-3">
                  <Badge variant={health.variant}>{health.label}</Badge>
                  <span className="text-sm text-muted">
                    {won.length} won · {deals.filter((d) => d.stage === "lost").length} lost ·{" "}
                    {deals.filter((d) => OPEN.includes(d.stage)).length} in flight
                  </span>
                </div>
              </Section>
            </>
          ),
        },
      ]}
    />
  );
}
