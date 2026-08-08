/**
 * Executive metrics — computed from live operational data (leads + engagement). One
 * pass over the org's leads yields pipeline, revenue, SDR leaderboard, source mix,
 * win rate, and an at-risk list. Permission-scoped by the caller (crm.read to view;
 * ₹ figures are only surfaced to finance-visible personas at the render layer).
 */
import { leadService } from "@/services/lead-service";
import { LEAD_STAGES, OPEN_LEAD_STAGES } from "@/lib/types";
import type { LeadDTO, User } from "@/lib/types";

const OPEN_STAGES: string[] = OPEN_LEAD_STAGES;

export interface StageMetric { stage: string; count: number; valueMinor: number }
export interface OwnerMetric { ownerId: string; count: number; wonMinor: number; pipelineMinor: number }
export interface SourceMetric { source: string; count: number }
export interface AtRiskLead { id: string; name: string; stage: string; reason: string }
export interface MonthlyWinRate { month: string; won: number; lost: number; winRatePct: number | null }
export interface MonthlyRevenue { month: string; wonMinor: number }
export interface FunnelStage { stage: string; count: number; conversionFromPrevPct: number | null }

export interface MetricsSummary {
  totalLeads: number;
  wonMinor: number;
  pipelineMinor: number;
  winRate: number | null; // won / (won + lost), or null if none closed
  byStage: StageMetric[];
  byOwner: OwnerMetric[];
  bySource: SourceMetric[];
  atRisk: AtRiskLead[];
  winRateByMonth: MonthlyWinRate[]; // last 6 months
  revenueTrendByMonth: MonthlyRevenue[]; // last 6 months
  avgSalesCycleDays: number | null; // won leads: created → closed, org-wide
  funnel: FunnelStage[]; // cumulative "ever reached this stage", derived from stageHistory
}

const MONTHS_WINDOW = 6;

function monthKey(d: Date | string | number): string {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function lastNMonths(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(monthKey(m));
  }
  return out;
}

/** When a lead actually closed — the latest stageHistory entry landing on won/lost, or
 *  updatedAt as a fallback for legacy rows without stage-change history. */
function closedAtOf(l: LeadDTO): number | null {
  if (l.stage !== "won" && l.stage !== "lost") return null;
  const closes = (l.stageHistory ?? [])
    .filter((h) => h.to === "won" || h.to === "lost")
    .map((h) => new Date(h.at).getTime());
  if (closes.length > 0) return Math.max(...closes);
  return new Date(l.updatedAt).getTime();
}

export const metricsService = {
  async summary(user: User, prefetchedLeads?: LeadDTO[]): Promise<MetricsSummary> {
    const leads = prefetchedLeads ?? await leadService.listLean(user);
    const now = Date.now();

    const stageMap = new Map<string, StageMetric>(
      LEAD_STAGES.map((s) => [s, { stage: s, count: 0, valueMinor: 0 }]),
    );
    const ownerMap = new Map<string, OwnerMetric>();
    const sourceMap = new Map<string, number>();
    const atRisk: AtRiskLead[] = [];
    let wonMinor = 0;
    let pipelineMinor = 0;
    let won = 0;
    let lost = 0;

    for (const l of leads) {
      const v = l.value?.amountMinor ?? 0;
      const sm = stageMap.get(l.stage);
      if (sm) {
        sm.count += 1;
        sm.valueMinor += v;
      }

      const om = ownerMap.get(l.ownerId) ?? { ownerId: l.ownerId, count: 0, wonMinor: 0, pipelineMinor: 0 };
      om.count += 1;
      if (l.stage === "won") om.wonMinor += v;
      if (OPEN_STAGES.includes(l.stage)) om.pipelineMinor += v;
      ownerMap.set(l.ownerId, om);

      if (l.source) sourceMap.set(l.source, (sourceMap.get(l.source) ?? 0) + 1);

      if (l.stage === "won") { wonMinor += v; won += 1; }
      else if (l.stage === "lost") lost += 1;
      if (OPEN_STAGES.includes(l.stage)) pipelineMinor += v;

      // Needs-attention heuristics
      if (OPEN_STAGES.includes(l.stage)) {
        const lastTouch = l.lastTouchAt ? new Date(l.lastTouchAt).getTime() : null;
        if ((l.touchCount ?? 0) >= 2 && lastTouch && now - lastTouch > 3 * 86400000) {
          atRisk.push({ id: l.id, name: l.name, stage: l.stage, reason: "No reply after follow-ups" });
        } else if (!lastTouch && now - new Date(l.createdAt).getTime() > 7 * 86400000) {
          atRisk.push({ id: l.id, name: l.name, stage: l.stage, reason: "Never contacted" });
        } else if (l.health === "red") {
          atRisk.push({ id: l.id, name: l.name, stage: l.stage, reason: "Marked stalled" });
        }
      }
    }

    // --- Monthly win rate + revenue trend (last 6 months, by actual close date) ---
    const months = lastNMonths(MONTHS_WINDOW);
    const monthIndex = new Map(months.map((m, i) => [m, i]));
    const winRateByMonth: MonthlyWinRate[] = months.map((m) => ({ month: m, won: 0, lost: 0, winRatePct: null }));
    const revenueTrendByMonth: MonthlyRevenue[] = months.map((m) => ({ month: m, wonMinor: 0 }));
    const cycleDays: number[] = [];

    for (const l of leads) {
      const closedAt = closedAtOf(l);
      if (closedAt === null) continue;
      if (l.stage === "won") {
        const start = new Date(l.createdAt).getTime();
        cycleDays.push((closedAt - start) / 86_400_000);
      }
      const idx = monthIndex.get(monthKey(closedAt));
      if (idx === undefined) continue; // closed outside the reporting window
      if (l.stage === "won") {
        winRateByMonth[idx].won += 1;
        revenueTrendByMonth[idx].wonMinor += l.value?.amountMinor ?? 0;
      } else {
        winRateByMonth[idx].lost += 1;
      }
    }
    for (const row of winRateByMonth) {
      row.winRatePct = row.won + row.lost > 0 ? Math.round((row.won / (row.won + row.lost)) * 100) : null;
    }
    const avgSalesCycleDays = cycleDays.length > 0
      ? Math.round((cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length) * 10) / 10
      : null;

    // --- Stage conversion funnel: "ever reached this stage", derived from stageHistory ---
    const reachedCount = new Map<string, number>(OPEN_STAGES.map((s) => [s, 0]));
    reachedCount.set("new", leads.length); // every lead starts at "new"
    for (const l of leads) {
      const reached = new Set<string>((l.stageHistory ?? []).map((h) => h.to));
      reached.add(l.stage);
      // "new" is already accounted for by the leads.length baseline above.
      for (const s of reached) if (s !== "new" && reachedCount.has(s)) reachedCount.set(s, reachedCount.get(s)! + 1);
    }
    let prevCount: number | null = null;
    const funnel: FunnelStage[] = OPEN_STAGES.map((stage) => {
      const count = reachedCount.get(stage) ?? 0;
      const conversionFromPrevPct = prevCount != null && prevCount > 0 ? Math.round((count / prevCount) * 100) : null;
      prevCount = count;
      return { stage, count, conversionFromPrevPct };
    });

    return {
      totalLeads: leads.length,
      wonMinor,
      pipelineMinor,
      winRate: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null,
      byStage: LEAD_STAGES.map((s) => stageMap.get(s)!).filter((m) => m.count > 0),
      byOwner: [...ownerMap.values()].sort((a, b) => b.wonMinor - a.wonMinor),
      bySource: [...sourceMap.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
      atRisk: atRisk.slice(0, 6),
      winRateByMonth,
      revenueTrendByMonth,
      avgSalesCycleDays,
      funnel,
    };
  },
};
