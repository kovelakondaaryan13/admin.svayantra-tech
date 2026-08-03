/**
 * Owner Command Center — one executive read over the whole operation. Answers the
 * questions an owner actually asks each morning: what happened, what's blocked, who needs
 * help, which deals are at risk, what's the forecast, how utilized is the team, and where
 * are the bottlenecks. Pure aggregation over existing services (no new data), so it always
 * reflects live reality. AI recommendations are generated separately (see ai/command-recommendations).
 */
import { leadService } from "@/services/lead-service";
import { metricsService } from "@/services/metrics-service";
import { conveyorMetricsService } from "@/services/conveyor-metrics-service";
import { activityService } from "@/services/activity-service";
import { workflowService } from "@/services/workflow-service";
import { taskService } from "@/services/task-service";
import { employeeService } from "@/services/employee-service";
import { isOwner } from "@/lib/iam";
import { fmtLakhCr as money } from "@/lib/format";
import type { User } from "@/lib/types";

const STAGE_WEIGHT: Record<string, number> = { new: 5, qualified: 20, meeting: 40, proposal: 60, negotiation: 80 };
const STAGE_LABEL: Record<string, string> = {
  new: "Sourcing", qualified: "Qualification", meeting: "Meeting", proposal: "Proposal", negotiation: "Negotiation",
};

export interface CommandCenter {
  yesterday: { total: number; items: { summary: string; at: string; kind: string }[] };
  blocked: { approvalsWaiting: number; slaBreaches: number; items: string[] };
  needHelp: { userId: string; name: string; openCount: number; capacity?: number; overdue: number }[];
  atRisk: { name: string; stage: string; reason: string }[];
  forecast: { bookedMinor: number; weightedPipelineMinor: number; totalPipelineMinor: number; winRate: number | null };
  utilization: { userId: string; name: string; openCount: number; capacity?: number; overloaded: boolean }[];
  bottlenecks: string[];
  pipelineByStage: { label: string; value: number; display: string }[];
  taskStats: { total: number; open: number; overdue: number; completedToday: number };
}

export const commandCenterService = {
  async summary(user: User): Promise<CommandCenter> {
    const owner = isOwner(user);
    const now = Date.now();
    const since = new Date(now - 2 * 86400000);
    const [leads, recent, instances, tasks, employees] = await Promise.all([
      leadService.listLean(user).catch(() => []),
      activityService.recent(user, 20, since).catch(() => []),
      workflowService.listInstances(user).catch(() => []),
      taskService.listScoped(user, owner ? "all" : "team").catch(() => []),
      employeeService.list(user).catch(() => []),
    ]);
    const [metrics, conveyor] = await Promise.all([
      metricsService.summary(user, leads).catch(() => null),
      conveyorMetricsService.summary(user, leads).catch(() => null),
    ]);

    const nameById = new Map(employees.map((e) => [e.userId, e.name]));
    const capById = new Map(employees.filter((e) => typeof e.capacity === "number").map((e) => [e.userId, e.capacity!]));

    // --- Yesterday (last 48h — already date-filtered by the query) ---
    const recentItems = recent
      .slice(0, 8)
      .map((a) => ({ summary: a.summary, at: new Date(a.createdAt).toISOString(), kind: a.kind }));
    const yesterday = {
      total: recent.length,
      items: recentItems,
    };

    // --- Blocked ---
    const waiting = instances.filter((i) => i.status === "running");
    const slaBreaches = conveyor?.teams.reduce((a, t) => a + t.breaches, 0) ?? 0;
    const blockedItems = [
      ...waiting.map((i) => `Approval pending: ${i.subjectId ?? i.workflowKey}`),
      ...(slaBreaches > 0 ? [`${slaBreaches} conveyor lead${slaBreaches === 1 ? "" : "s"} past SLA`] : []),
    ].slice(0, 8);
    const blocked = { approvalsWaiting: waiting.length, slaBreaches, items: blockedItems };

    // --- Workload (utilization + who needs help) ---
    const counts = new Map<string, { open: number; overdue: number }>();
    for (const t of tasks) {
      if (t.status !== "open") continue;
      const row = counts.get(t.assigneeId) ?? { open: 0, overdue: 0 };
      row.open += 1;
      if (t.dueAt && new Date(t.dueAt).getTime() < now) row.overdue += 1;
      counts.set(t.assigneeId, row);
    }
    const utilization = [...counts.entries()]
      .map(([userId, c]) => {
        const capacity = capById.get(userId);
        return {
          userId,
          name: nameById.get(userId) ?? "Unassigned",
          openCount: c.open,
          capacity,
          overloaded: capacity != null && c.open > capacity,
        };
      })
      .sort((a, b) => b.openCount - a.openCount);
    const needHelp = utilization
      .filter((u) => u.overloaded || (counts.get(u.userId)?.overdue ?? 0) >= 2)
      .map((u) => ({
        userId: u.userId, name: u.name, openCount: u.openCount, capacity: u.capacity,
        overdue: counts.get(u.userId)?.overdue ?? 0,
      }));

    // --- Deals at risk ---
    const atRisk = (metrics?.atRisk ?? []).map((r) => ({ name: r.name, stage: r.stage, reason: r.reason }));

    // --- Forecast (weighted pipeline) ---
    const weightedPipelineMinor = (metrics?.byStage ?? []).reduce(
      (sum, s) => sum + s.valueMinor * ((STAGE_WEIGHT[s.stage] ?? 0) / 100), 0,
    );
    const forecast = {
      bookedMinor: metrics?.wonMinor ?? 0,
      weightedPipelineMinor: Math.round(weightedPipelineMinor),
      totalPipelineMinor: metrics?.pipelineMinor ?? 0,
      winRate: metrics?.winRate ?? null,
    };

    // --- Pipeline by stage (for charts) ---
    const pipelineByStage = (metrics?.byStage ?? [])
      .filter(s => STAGE_WEIGHT[s.stage] != null)
      .map(s => ({
        label: STAGE_LABEL[s.stage] ?? s.stage,
        value: s.valueMinor,
        display: money(s.valueMinor),
      }));

    // --- Task stats ---
    const allTasks = tasks;
    const openTasks = allTasks.filter(t => t.status === "open");
    const overdueTasks = openTasks.filter(t => t.dueAt && new Date(t.dueAt).getTime() < now);
    const completedToday = allTasks.filter(t => t.status === "done" && t.updatedAt && (now - new Date(t.updatedAt).getTime()) < 86400000);
    const taskStats = {
      total: allTasks.length,
      open: openTasks.length,
      overdue: overdueTasks.length,
      completedToday: completedToday.length,
    };

    // --- Bottlenecks ---
    const bottlenecks: string[] = [];
    for (const t of conveyor?.teams ?? []) {
      if (t.bottleneckStage) bottlenecks.push(`${t.teamName}: ${STAGE_LABEL[t.bottleneckStage] ?? t.bottleneckStage} stage is holding the most leads`);
    }
    const openStages = (metrics?.byStage ?? []).filter((s) => STAGE_WEIGHT[s.stage] != null);
    const topStage = [...openStages].sort((a, b) => b.count - a.count)[0];
    if (topStage) bottlenecks.push(`Pipeline: most open deals sit in ${STAGE_LABEL[topStage.stage] ?? topStage.stage} (${topStage.count})`);

    return { yesterday, blocked, needHelp, atRisk, forecast, utilization, bottlenecks: bottlenecks.slice(0, 5), pipelineByStage, taskStats };
  },
};
