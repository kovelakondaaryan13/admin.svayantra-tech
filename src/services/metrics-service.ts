/**
 * Executive metrics — computed from live operational data (leads + engagement). One
 * pass over the org's leads yields pipeline, revenue, SDR leaderboard, source mix,
 * win rate, and an at-risk list. Permission-scoped by the caller (crm.read to view;
 * ₹ figures are only surfaced to finance-visible personas at the render layer).
 */
import { leadService } from "@/services/lead-service";
import { LEAD_STAGES } from "@/lib/types";
import type { LeadDTO, User } from "@/lib/types";

const OPEN_STAGES = ["new", "qualified", "meeting", "proposal", "negotiation"];

export interface StageMetric { stage: string; count: number; valueMinor: number }
export interface OwnerMetric { ownerId: string; count: number; wonMinor: number; pipelineMinor: number }
export interface SourceMetric { source: string; count: number }
export interface AtRiskLead { id: string; name: string; stage: string; reason: string }

export interface MetricsSummary {
  totalLeads: number;
  wonMinor: number;
  pipelineMinor: number;
  winRate: number | null; // won / (won + lost), or null if none closed
  byStage: StageMetric[];
  byOwner: OwnerMetric[];
  bySource: SourceMetric[];
  atRisk: AtRiskLead[];
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

    return {
      totalLeads: leads.length,
      wonMinor,
      pipelineMinor,
      winRate: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null,
      byStage: LEAD_STAGES.map((s) => stageMap.get(s)!).filter((m) => m.count > 0),
      byOwner: [...ownerMap.values()].sort((a, b) => b.wonMinor - a.wonMinor),
      bySource: [...sourceMap.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
      atRisk: atRisk.slice(0, 6),
    };
  },
};
