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
import { fmtLakhCr as inr, fmtRelativeTime } from "@/lib/format";
import {
  ObjectPage, Section, KpiRow, StatTile, Timeline, Badge, Avatar, STAGE_BADGE,
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

  const [contacts, allLeads, allDocs, allMeetings, companyActs] = await Promise.all([
    contactService.list(user).catch(() => []),
    leadService.list(user).catch(() => []),
    documentService.list(user).catch(() => []),
    meetingService.list(user).catch(() => []),
    activityService.listForEntity(user, "company", id).catch(() => []),
  ]);

  const deals = allLeads.filter((l) => l.companyId === id || (company.name && l.company === company.name));
  const people = contacts.filter((c) => c.companyId === id);
  const docs = allDocs.filter((d) => d.companyId === id);
  const dealIds = new Set(deals.map((d) => d.id));
  const meetings = allMeetings.filter((m) => m.leadId && dealIds.has(m.leadId));

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
              <Section title={`Meetings (${meetings.length})`}>
                {meetings.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-muted">No meetings yet.</p>
                ) : (
                  <Timeline
                    items={meetings
                      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
                      .map((m) => ({ id: m.id, title: m.title, time: new Date(m.at).toLocaleDateString(), tone: "neutral" as const }))}
                  />
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
