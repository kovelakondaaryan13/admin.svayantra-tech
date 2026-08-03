import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/iam";
import { AskBar } from "@/components/home/ask-bar";
import { taskService } from "@/services/task-service";
import { workflowService } from "@/services/workflow-service";
import { meetingService } from "@/services/meeting-service";
import { activityService } from "@/services/activity-service";
import { financeService } from "@/services/finance-service";
import { metricsService } from "@/services/metrics-service";
import { employeeService } from "@/services/employee-service";
import nextDynamic from "next/dynamic";
import { commandCenterService } from "@/services/command-center-service";
import { fmtINR as inr } from "@/lib/format";

const Dashboard = nextDynamic(() => import("@/components/home/dashboard").then(m => m.Dashboard));
const ExecutiveDashboard = nextDynamic(() => import("@/components/home/executive-dashboard").then(m => m.ExecutiveDashboard));
import { WorkspaceToggle } from "@/components/shell/workspace-toggle";
import { getOrgMode } from "@/lib/mode";
import { isOwner } from "@/lib/iam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
export default async function HomePage() {
  const user = await requireUser();
  const first = (user.name ?? user.email).split(/[ @]/)[0];
  const mode = isOwner(user) ? await getOrgMode(user.orgId) : null;

  const showValues = can(user, "finance.read");
  const showLeaderboard = can(user, "users.read"); // managers/owner see the rep leaderboard
  const exec = can(user, "users.read");

  // Single parallel fetch — executives get CC (which covers metrics/activity/tasks/employees internally),
  // non-executives get each service individually. No waterfall, no duplicate queries.
  const [tasks, instances, meetings, activity, finance, metrics, employees, cc] = await Promise.all([
    !exec && (can(user, "tasks.assign") || can(user, "crm.read")) ? taskService.listOpenForUser(user) : Promise.resolve([]),
    can(user, "workflows.approve") ? workflowService.listInstances(user) : Promise.resolve([]),
    can(user, "calendar.read") ? meetingService.list(user) : Promise.resolve([]),
    !exec ? activityService.recent(user, 6) : Promise.resolve([]),
    !exec && can(user, "finance.read") ? financeService.summary(user).catch(() => null) : Promise.resolve(null),
    !exec && can(user, "crm.read") ? metricsService.summary(user).catch(() => null) : Promise.resolve(null),
    !exec && showLeaderboard ? employeeService.list(user).catch(() => []) : Promise.resolve([]),
    exec ? commandCenterService.summary(user).catch(() => null) : Promise.resolve(null),
  ]);
  const nameByOwner: Record<string, string> = {};
  for (const e of employees) nameByOwner[e.userId] = e.name;

  const now = Date.now();
  const upcoming = meetings.filter((m) => new Date(m.at).getTime() > now).slice(0, 3);
  const pending = instances.filter((i) => i.status === "running").slice(0, 4);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  // Format all dates on the SERVER (deterministic, no locale/TZ SSR-CSR drift) and pass strings.
  const fmtClock = (d: Date) => {
    let h = d.getHours(); const m = d.getMinutes(); const ap = h < 12 ? "AM" : "PM";
    h = h % 12 || 12; return `${h}:${String(m).padStart(2, "0")} ${ap}`;
  };
  const fmtRel = (d: Date) => { const days = Math.floor((now - d.getTime()) / 86400000); return days >= 1 ? `${days}d ago` : "today"; };
  const meetingsToday = meetings
    .filter((m) => { const t = new Date(m.at).getTime(); return t >= now && t <= todayEnd.getTime(); })
    .map((m) => ({ title: m.title, time: fmtClock(new Date(m.at)) }));
  const overnight = (cc?.yesterday.items ?? []).map((a) => ({
    summary: a.summary,
    time: fmtRel(new Date(a.at)),
    tone: (a.kind === "won" ? "won" : a.kind === "lost" ? "lost" : "note") as "won" | "lost" | "note",
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {greeting()}, <span className="text-gradient">{first}</span>.
          </h1>
          <p className="mt-1.5 text-sm text-muted">Here&apos;s what needs you today.</p>
        </div>
        {mode && (
          <div className="text-right">
            <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">Workspace</div>
            <WorkspaceToggle initialMode={mode} />
          </div>
        )}
      </header>

      <AskBar />

      {exec && cc ? (
        <ExecutiveDashboard cc={cc} meetingsToday={meetingsToday} overnight={overnight} />
      ) : (
      <>
      {/* Revenue — only for finance-visible personas */}
      {finance && (
        <section className="grid grid-cols-3 gap-3">
          <div className="glass p-4">
            <div className="text-xs text-muted">Won</div>
            <div className="mt-1 text-xl font-semibold text-teal">{inr(finance.wonValueMinor)}</div>
          </div>
          <div className="glass p-4">
            <div className="text-xs text-muted">In pipeline</div>
            <div className="mt-1 text-xl font-semibold">{inr(finance.pipelineValueMinor)}</div>
          </div>
          <div className="glass p-4">
            <div className="text-xs text-muted">Open tasks</div>
            <div className="mt-1 text-xl font-semibold">{tasks.length}</div>
          </div>
        </section>
      )}

      {metrics && metrics.totalLeads > 0 && (
        <Dashboard
          metrics={metrics}
          nameByOwner={nameByOwner}
          showValues={showValues}
          showLeaderboard={showLeaderboard}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Briefing title="Today's priorities" href="/work" empty="You're all caught up — nothing pressing.">
          {tasks.slice(0, 5).map((t) => (
            <Row key={t.id} main={t.title} sub={t.priority ?? "task"} />
          ))}
        </Briefing>

        {pending.length > 0 && (
          <Briefing title="Waiting on your approval" href="/workspace" empty="">
            {pending.map((i) => (
              <Row key={i.id} main={`${i.workflowKey.replace(/_/g, " ")}`} sub={String(i.subjectId ?? "")} accent />
            ))}
          </Briefing>
        )}

        {upcoming.length > 0 && (
          <Briefing title="Upcoming meetings" href="/work" empty="">
            {upcoming.map((m) => (
              <Row key={m.id} main={m.title} sub={new Date(m.at).toLocaleString()} />
            ))}
          </Briefing>
        )}

        <Briefing title="Recent activity" href="/workspace" empty="Nothing has happened yet.">
          {activity.map((a) => (
            <Row key={a.id} main={a.summary} sub={a.kind} />
          ))}
        </Briefing>
      </div>
      </>
      )}
    </div>
  );
}

function Briefing({
  title,
  href,
  empty,
  children,
}: {
  title: string;
  href: string;
  empty: string;
  children: React.ReactNode[];
}) {
  const has = Array.isArray(children) && children.length > 0;
  return (
    <section className="glass p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-fg">{title}</h2>
        <Link href={href} className="text-xs text-muted hover:text-accent">
          open →
        </Link>
      </div>
      {has ? <div className="space-y-1">{children}</div> : <p className="text-sm text-muted">{empty}</p>}
    </section>
  );
}

function Row({ main, sub, accent }: { main: string; sub?: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-overlay/[0.03]">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${accent ? "bg-action" : "bg-accent/70"}`} />
      <span className="min-w-0 flex-1 truncate text-fg">{main}</span>
      {sub && <span className="shrink-0 text-xs text-muted">{sub}</span>}
    </div>
  );
}
