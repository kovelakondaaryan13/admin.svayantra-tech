import type { ConveyorMetrics, ConveyorTeamMetric } from "@/services/conveyor-metrics-service";
import { MiniKpi as Kpi, type MiniKpiTone as Tone } from "@/components/ds/kpi";

const STAGE_LABEL: Record<string, string> = {
  new: "Sourcing",
  qualified: "Qualification",
  meeting: "Meeting",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

function fmt(n: number | null, suffix = "") {
  return n === null ? "—" : `${n}${suffix}`;
}

export function ConveyorDashboard({ metrics }: { metrics: ConveyorMetrics }) {
  if (metrics.totalConveyorLeads === 0) {
    return (
      <div className="glass p-10 text-center">
        <p className="text-sm font-medium text-fg">No conveyor leads yet</p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted">
          Assign leads to the <span className="text-fg">Conveyor Belt</span> execution model
          and a conveyor team (on any lead&apos;s detail page) to see stage throughput, SLA
          compliance, handoff times, and bottlenecks here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs text-muted">
        <span className="rounded-full border border-border px-2 py-0.5">
          {metrics.totalConveyorLeads} conveyor lead{metrics.totalConveyorLeads === 1 ? "" : "s"}
        </span>
        <span className="rounded-full border border-border px-2 py-0.5">
          {metrics.teams.length} team{metrics.teams.length === 1 ? "" : "s"}
        </span>
        {metrics.unassigned > 0 && (
          <span className="rounded-full border border-action/40 px-2 py-0.5 text-action">
            {metrics.unassigned} unassigned to a team
          </span>
        )}
      </div>

      {metrics.teams.map((t) => (
        <TeamCard key={t.teamId} team={t} />
      ))}
    </div>
  );
}

function TeamCard({ team }: { team: ConveyorTeamMetric }) {
  const maxStage = Math.max(1, ...team.byStage.map((s) => s.count));
  return (
    <section className="glass space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-fg">{team.teamName}</h2>
          <p className="text-xs text-muted">
            {team.memberCount} member{team.memberCount === 1 ? "" : "s"} · {team.activeLeads} active ·{" "}
            {team.won} won · {team.lost} lost
          </p>
        </div>
        {team.bottleneckStage && (
          <span className="rounded-full border border-action/40 bg-action/10 px-2 py-0.5 text-xs text-action">
            Bottleneck: {STAGE_LABEL[team.bottleneckStage] ?? team.bottleneckStage}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="SLA compliance" value={fmt(team.slaCompliancePct, "%")} tone={slaTone(team.slaCompliancePct)} />
        <Kpi label="Active breaches" value={String(team.breaches)} tone={team.breaches > 0 ? "bad" : "good"} />
        <Kpi label="Avg handoff" value={fmt(team.avgHandoffHours, "h")} />
        <Kpi label="Avg cycle" value={fmt(team.avgCycleDays, "d")} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Leads per stage</h3>
          <span className="text-xs text-muted">
            conversion {fmt(team.conversionPct, "%")}
          </span>
        </div>
        <div className="space-y-1.5">
          {team.byStage.map((s) => (
            <div key={s.stage} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs text-fg/80">{STAGE_LABEL[s.stage] ?? s.stage}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-overlay/[0.06]">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.round((s.count / maxStage) * 100)}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-xs text-muted">
                {s.count}
                {s.breached > 0 ? <span className="text-action"> · {s.breached}⚠</span> : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function slaTone(pct: number | null): Tone {
  if (pct === null) return "neutral";
  if (pct >= 80) return "good";
  if (pct >= 50) return "neutral";
  return "bad";
}
