/**
 * Conveyor throughput analytics — computed from live conveyor leads. One pass over the
 * org's conveyor-model leads yields, per team: leads-per-stage, SLA compliance, average
 * handoff time (from ownerHistory), stage conversion, the current bottleneck stage,
 * cycle time (won leads), and throughput. Managers compare teams; the metrics-service
 * (Sprint 9) stays focused on org-wide revenue.
 *
 * Permission-scoped by the caller (sales.read to view; managers/owner see all teams).
 */
import { leadService } from "@/services/lead-service";
import { conveyorTeamService } from "@/services/conveyor-team-service";
import { LEAD_STAGES } from "@/lib/types";
import type { User } from "@/lib/types";

const OPEN_STAGES = ["new", "qualified", "meeting", "proposal", "negotiation"];
const HOUR = 3600_000;
const DAY = 86_400_000;

export interface ConveyorStageMetric {
  stage: string;
  count: number;
  breached: number; // active leads at this stage past their SLA deadline
}

export interface ConveyorTeamMetric {
  teamId: string;
  teamName: string;
  memberCount: number;
  totalLeads: number;
  activeLeads: number;
  won: number;
  lost: number;
  byStage: ConveyorStageMetric[];
  slaCompliancePct: number | null; // % of active, deadlined leads still within SLA
  breaches: number; // active leads past their stage deadline
  avgHandoffHours: number | null; // mean gap between consecutive ownerHistory entries
  avgCycleDays: number | null; // won leads: first stage change → won
  conversionPct: number | null; // won / (won + lost)
  bottleneckStage: string | null; // active stage holding the most leads
}

export interface ConveyorMetrics {
  teams: ConveyorTeamMetric[];
  unassigned: number; // conveyor leads with no team
  totalConveyorLeads: number;
}

function ms(d: Date | string | undefined): number | null {
  if (!d) return null;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? null : t;
}

export const conveyorMetricsService = {
  async summary(user: User, prefetchedLeads?: Awaited<ReturnType<typeof leadService.list>>): Promise<ConveyorMetrics> {
    const [leads, teams] = await Promise.all([
      prefetchedLeads ? Promise.resolve(prefetchedLeads) : leadService.listLean(user),
      conveyorTeamService.list(user),
    ]);
    const now = Date.now();

    const conveyor = leads.filter((l) => l.executionModel === "conveyor");
    const teamName = new Map(teams.map((t) => [t.id, t.name]));
    const teamSize = new Map(teams.map((t) => [t.id, t.memberUserIds.length]));

    // Bucket leads by team (undefined team → "unassigned").
    const byTeam = new Map<string, typeof conveyor>();
    let unassigned = 0;
    for (const l of conveyor) {
      const key = l.conveyorTeamId ?? "";
      if (!key) unassigned += 1;
      const arr = byTeam.get(key) ?? [];
      arr.push(l);
      byTeam.set(key, arr);
    }

    const teamMetrics: ConveyorTeamMetric[] = [];
    for (const [teamId, teamLeads] of byTeam) {
      if (!teamId) continue; // unassigned reported separately

      const stageMap = new Map<string, ConveyorStageMetric>(
        LEAD_STAGES.map((s) => [s, { stage: s, count: 0, breached: 0 }]),
      );
      let won = 0;
      let lost = 0;
      let active = 0;
      let deadlined = 0;
      let withinSla = 0;
      let breaches = 0;
      const handoffGaps: number[] = [];
      const cycleDays: number[] = [];

      for (const l of teamLeads) {
        const sm = stageMap.get(l.stage);
        if (sm) sm.count += 1;

        if (l.stage === "won") won += 1;
        else if (l.stage === "lost") lost += 1;

        if (OPEN_STAGES.includes(l.stage)) {
          active += 1;
          const deadline = ms(l.stageDeadline);
          if (deadline !== null) {
            deadlined += 1;
            if (deadline >= now) withinSla += 1;
            else {
              breaches += 1;
              if (sm) sm.breached += 1;
            }
          }
        }

        // Handoff durations: consecutive ownerHistory timestamps.
        const hist = (l.ownerHistory ?? [])
          .map((h) => ms(h.at))
          .filter((t): t is number => t !== null)
          .sort((a, b) => a - b);
        for (let i = 1; i < hist.length; i++) handoffGaps.push(hist[i] - hist[i - 1]);

        // Cycle time for won leads: first recorded stage change → now (proxy for close).
        if (l.stage === "won") {
          const first = (l.stageHistory ?? [])
            .map((s) => ms(s.at))
            .filter((t): t is number => t !== null)
            .sort((a, b) => a - b)[0];
          const start = first ?? ms(l.createdAt);
          if (start !== null) cycleDays.push((now - start) / DAY);
        }
      }

      const activeByStage = [...stageMap.values()].filter(
        (m) => OPEN_STAGES.includes(m.stage) && m.count > 0,
      );
      const bottleneck = activeByStage.sort((a, b) => b.count - a.count)[0]?.stage ?? null;

      teamMetrics.push({
        teamId,
        teamName: teamName.get(teamId) ?? "Unknown team",
        memberCount: teamSize.get(teamId) ?? 0,
        totalLeads: teamLeads.length,
        activeLeads: active,
        won,
        lost,
        byStage: LEAD_STAGES.map((s) => stageMap.get(s)!).filter((m) => m.count > 0),
        slaCompliancePct: deadlined > 0 ? Math.round((withinSla / deadlined) * 100) : null,
        breaches,
        avgHandoffHours:
          handoffGaps.length > 0
            ? Math.round((handoffGaps.reduce((a, b) => a + b, 0) / handoffGaps.length / HOUR) * 10) / 10
            : null,
        avgCycleDays:
          cycleDays.length > 0
            ? Math.round((cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length) * 10) / 10
            : null,
        conversionPct: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null,
        bottleneckStage: bottleneck,
      });
    }

    teamMetrics.sort((a, b) => b.activeLeads - a.activeLeads);

    return {
      teams: teamMetrics,
      unassigned,
      totalConveyorLeads: conveyor.length,
    };
  },
};
