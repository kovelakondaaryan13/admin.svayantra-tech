import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/iam";
import { employeeService } from "@/services/employee-service";
import { taskService } from "@/services/task-service";
import { meetingService } from "@/services/meeting-service";
import { leadService } from "@/services/lead-service";
import { computeEmployeeView } from "@/services/employee-view-service";
import { slaComplianceByOwner } from "@/services/conveyor-metrics-service";
import { composeScore, workloadIdealnessSignal, capacityHeadroomSignal, taskCompletionSignal, reliabilitySignal, orgMedianCapacity } from "@/lib/employee-score";
import { ObjectContext } from "@/components/context/object-context";
import {
  ObjectPage, Section, KpiRow, StatTile, Timeline, Badge, Avatar,
  type ObjectActionItem, type TimelineItem, type BadgeVariant,
} from "@/components/ds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "users.read")) redirect("/home");
  const { id } = await params;

  const person = await employeeService.get(user, id).catch(() => null);
  if (!person) redirect("/people");

  const [employees, allTasks, allMeetings, allLeads] = await Promise.all([
    employeeService.list(user).catch(() => []),
    taskService.list(user).catch(() => []),
    meetingService.list(user).catch(() => []),
    leadService.list(user).catch(() => []),
  ]);

  // Computed view — all KPIs derived from live data (never stored).
  const view = computeEmployeeView(person.userId, person.capacity, {
    leads: allLeads, tasks: allTasks, meetings: allMeetings, slaByOwner: slaComplianceByOwner(allLeads),
  });

  const now = Date.now();
  const myTasks = allTasks.filter((t) => t.assigneeId === person.userId);
  const open = myTasks.filter((t) => t.status === "open");
  const overdue = open.filter((t) => t.dueAt && new Date(t.dueAt).getTime() < now);
  const done = myTasks.filter((t) => t.status === "done");
  const myMeetings = allMeetings.filter((m) => m.ownerId === person.userId);
  const manager = employees.find((e) => e.userId === person.managerUserId);
  const reports = employees.filter((e) => e.managerUserId === person.userId);
  const overloaded = typeof person.capacity === "number" && open.length > person.capacity;
  const orgCapacities = employees.filter((e) => typeof e.capacity === "number").map((e) => e.capacity!);
  const medianCapacity = orgMedianCapacity(orgCapacities);
  const score = composeScore([
    { key: "workload", label: "Workload balance", value: workloadIdealnessSignal(open.length, person.capacity, medianCapacity), weight: 0.25 },
    { key: "capacity", label: "Capacity headroom", value: capacityHeadroomSignal(open.length, person.capacity, medianCapacity), weight: 0.15 },
    { key: "sla", label: "SLA compliance", value: view.slaCompliancePct, weight: 0.25 },
    { key: "reliability", label: "On-time rate", value: reliabilitySignal(open.length, overdue.length), weight: 0.15 },
    { key: "completion", label: "Task completion", value: taskCompletionSignal(done.length, open.length), weight: 0.2 },
  ]);

  const availVariant: BadgeVariant = person.availability === "available" ? "success" : person.availability === "busy" ? "warning" : "neutral";

  const summary = `${person.name} — ${person.title ?? person.roleKey}. ${open.length} open task${open.length === 1 ? "" : "s"}${
    person.capacity ? ` of ${person.capacity} capacity` : ""
  }${overdue.length ? `, ${overdue.length} overdue` : ""}.${manager ? ` Reports to ${manager.name}.` : ""}${
    reports.length ? ` Manages ${reports.length}.` : ""
  }${overloaded ? " ⚠ Currently overloaded." : ""}`;

  const workItems: TimelineItem[] = open.slice(0, 12).map((t) => ({
    id: t.id,
    title: t.leadId ? <Link href={`/work/${t.leadId}`} className="hover:text-accent">{t.title}</Link> : t.title,
    meta: t.priority ?? undefined,
    time: t.dueAt ? (new Date(t.dueAt).getTime() < now ? "overdue" : new Date(t.dueAt).toLocaleDateString()) : undefined,
    tone: t.dueAt && new Date(t.dueAt).getTime() < now ? "lost" : "neutral",
  }));
  const meetingItems: TimelineItem[] = myMeetings
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    .map((m) => ({ id: m.id, title: m.title, time: new Date(m.at).toLocaleDateString(), tone: "neutral" as const }));

  const q = person.name;
  const actionBar: ObjectActionItem[] = [
    { label: "Assign work", tier: "primary", intent: `Assign a task to ${q}: `, intentKey: "assign_work" },
    { label: "Schedule 1:1", intent: `Schedule a 1:1 with ${q}.`, intentKey: "schedule_1on1" },
  ];

  return (
    <ObjectPage
      kind="Person"
      name={person.name}
      statuses={[
        { label: person.roleKey.replace(/_/g, " "), variant: "brand" },
        ...(person.availability ? [{ label: person.availability, variant: availVariant }] : []),
        ...(overloaded ? [{ label: "overloaded", variant: "danger" as BadgeVariant }] : []),
      ]}
      aiSummary={summary}
      actions={<Link href="/people" className="btn-ghost text-xs">← All people</Link>}
      actionBar={actionBar}
      askAi={`Summarize ${q}'s workload and performance, and flag anything I should act on.`}
      objectRef={{ type: "person", id }}
      tabs={[
        {
          key: "context",
          label: "Context",
          content: (
            <ObjectContext
              type="person"
              id={id}
              aiSummary={summary}
              extras={
                <>
                  <Section title="Workload & performance" variant="plain">
                    <KpiRow>
                      <StatTile
                        label="Overall score"
                        value={`${score.overall} / 100`}
                        tone={score.overall >= 70 ? "good" : score.overall >= 40 ? "neutral" : "bad"}
                        icon="📊"
                      />
                      <StatTile label="Open work" value={String(open.length)} tone={overloaded ? "bad" : "neutral"} icon="✅" />
                      <StatTile label="Overdue" value={String(overdue.length)} tone={overdue.length ? "bad" : "good"} icon="⏰" />
                      <StatTile label="Capacity" value={person.capacity ? String(person.capacity) : "—"} icon="📦" />
                      <StatTile label="Completed" value={String(done.length)} tone="good" icon="🏁" />
                    </KpiRow>
                  </Section>
                  {view.kpis.length > 0 && (
                    <Section title="KPIs" action={<span className="t-micro">computed live</span>}>
                      <div className="flex flex-wrap gap-2">
                        {view.kpis.map((k) => (
                          <span key={k.label} className="rounded-lg border border-border bg-overlay/[0.02] px-3 py-1.5">
                            <span className="text-sm font-semibold text-fg">{k.value}</span>{" "}
                            <span className="t-micro">{k.label}</span>
                          </span>
                        ))}
                      </div>
                    </Section>
                  )}
                  {person.skills && person.skills.length > 0 && (
                    <Section title="Skills">
                      <div className="flex flex-wrap gap-1.5">
                        {person.skills.map((s) => <Badge key={s} variant="neutral">{s}</Badge>)}
                      </div>
                    </Section>
                  )}
                  <Section title="Manager">
                    {manager ? (
                      <Link href={`/people/${manager.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-overlay/[0.03]">
                        <Avatar name={manager.name} size="sm" />
                        <div><div className="text-sm text-fg">{manager.name}</div><div className="t-micro">{manager.title ?? manager.roleKey}</div></div>
                      </Link>
                    ) : <p className="px-1 py-2 text-sm text-muted">No manager assigned.</p>}
                  </Section>
                  {reports.length > 0 && (
                    <Section title={`Direct reports (${reports.length})`}>
                      <div className="space-y-1">
                        {reports.map((r) => (
                          <Link key={r.id} href={`/people/${r.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-overlay/[0.03]">
                            <Avatar name={r.name} size="sm" />
                            <div><div className="text-sm text-fg">{r.name}</div><div className="t-micro">{r.title ?? r.roleKey}</div></div>
                          </Link>
                        ))}
                      </div>
                    </Section>
                  )}
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
              <Section title={`Open work (${open.length})`}>
                {open.length ? <Timeline items={workItems} compact /> : <p className="px-1 py-2 text-sm text-muted">Nothing open.</p>}
              </Section>
              <Section title={`Meetings (${myMeetings.length})`}>
                {myMeetings.length ? <Timeline items={meetingItems} /> : <p className="px-1 py-2 text-sm text-muted">No meetings scheduled.</p>}
              </Section>
            </>
          ),
        },
      ]}
    />
  );
}
