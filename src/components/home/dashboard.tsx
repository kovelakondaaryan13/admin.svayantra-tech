import Link from "next/link";
import { fmtINR as inr, monthLabel as MONTH_LABEL } from "@/lib/format";
import { BarChart, BarChartH, type BarDatum } from "@/components/ds";
import type { MetricsSummary } from "@/services/metrics-service";

const STAGE_COLOR: Record<string, string> = {
  new: "bg-overlay/20", qualified: "bg-accent/60", meeting: "bg-accent/80",
  proposal: "bg-action/70", negotiation: "bg-action", won: "bg-teal", lost: "bg-red-400/60",
};

/** Persona-aware executive dashboard rendered on Home. */
export function Dashboard({
  metrics,
  nameByOwner,
  showValues,
  showLeaderboard,
}: {
  metrics: MetricsSummary;
  nameByOwner: Record<string, string>;
  showValues: boolean;
  showLeaderboard: boolean;
}) {
  const maxStage = Math.max(1, ...metrics.byStage.map((s) => s.count));
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-fg">Business at a glance</h2>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Pipeline by stage */}
        <section className="glass p-4">
          <div className="mb-2 text-sm font-medium text-fg">Pipeline by stage</div>
          <div className="space-y-1.5">
            {metrics.byStage.map((s) => (
              <div key={s.stage} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 capitalize text-muted">{s.stage}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-overlay/5">
                  <div className={`h-full rounded-full ${STAGE_COLOR[s.stage] ?? "bg-accent"}`} style={{ width: `${(s.count / maxStage) * 100}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right text-fg">{s.count}</span>
                {showValues && <span className="w-24 shrink-0 text-right text-muted">{inr(s.valueMinor)}</span>}
              </div>
            ))}
            {metrics.byStage.length === 0 && <p className="text-sm text-muted">No leads yet.</p>}
          </div>
          {metrics.winRate !== null && (
            <p className="mt-3 text-xs text-muted">Win rate: <span className="text-teal">{metrics.winRate}%</span></p>
          )}
        </section>

        {/* SDR leaderboard (managers/owner) or source mix */}
        {showLeaderboard ? (
          <section className="glass p-4">
            <div className="mb-2 text-sm font-medium text-fg">Rep leaderboard</div>
            <div className="space-y-1">
              {metrics.byOwner.slice(0, 5).map((o) => (
                <div key={o.ownerId} className="flex items-center gap-2 text-sm">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                  <span className="min-w-0 flex-1 truncate text-fg">{nameByOwner[o.ownerId] ?? "Unassigned"}</span>
                  <span className="shrink-0 text-xs text-muted">{o.count} leads</span>
                  {showValues && <span className="w-24 shrink-0 text-right text-xs text-teal">{inr(o.wonMinor)} won</span>}
                </div>
              ))}
              {metrics.byOwner.length === 0 && <p className="text-sm text-muted">No reps yet.</p>}
            </div>
          </section>
        ) : (
          <section className="glass p-4">
            <div className="mb-2 text-sm font-medium text-fg">Where leads come from</div>
            <div className="space-y-1">
              {metrics.bySource.map((s) => (
                <div key={s.source} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate capitalize text-fg">{s.source}</span>
                  <span className="shrink-0 text-xs text-muted">{s.count}</span>
                </div>
              ))}
              {metrics.bySource.length === 0 && <p className="text-sm text-muted">No source data yet.</p>}
            </div>
          </section>
        )}
      </div>

      {/* Trend + funnel */}
      {(metrics.funnel.some((f) => f.count > 0) || (showValues && metrics.revenueTrendByMonth.some((r) => r.wonMinor > 0))) && (
        <div className="grid gap-4 md:grid-cols-2">
          {showValues && metrics.revenueTrendByMonth.some((r) => r.wonMinor > 0) && (
            <section className="glass p-4">
              <div className="mb-2 text-sm font-medium text-fg">Monthly revenue trend</div>
              <BarChart data={metrics.revenueTrendByMonth.map((r): BarDatum => ({
                label: MONTH_LABEL(r.month),
                value: r.wonMinor,
                display: inr(r.wonMinor),
              }))} />
            </section>
          )}
          {metrics.funnel.some((f) => f.count > 0) && (
            <section className="glass p-4">
              <div className="mb-2 text-sm font-medium text-fg">Stage conversion funnel</div>
              <BarChartH data={metrics.funnel.map((f): BarDatum => ({
                label: f.stage,
                value: f.count,
                display: f.conversionFromPrevPct == null ? `${f.count}` : `${f.count} (${f.conversionFromPrevPct}%)`,
              }))} />
              {metrics.avgSalesCycleDays != null && (
                <p className="mt-3 text-xs text-muted">Average sales cycle: <span className="text-fg">{metrics.avgSalesCycleDays} days</span></p>
              )}
            </section>
          )}
        </div>
      )}

      {/* Needs attention */}
      {metrics.atRisk.length > 0 && (
        <section className="glass p-4">
          <div className="mb-2 text-sm font-medium text-fg">Deals that need attention</div>
          <div className="space-y-1">
            {metrics.atRisk.map((r) => (
              <Link key={r.id} href={`/work/${r.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-overlay/[0.03]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-action" />
                <span className="min-w-0 flex-1 truncate text-fg">{r.name}</span>
                <span className="shrink-0 text-xs text-muted">{r.stage} · {r.reason}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
