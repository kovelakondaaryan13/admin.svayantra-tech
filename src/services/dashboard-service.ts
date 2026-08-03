/**
 * Dashboard aggregation. ONE role-scoped dashboard, not three code paths (ADR /
 * .claude/skills/ui/build-dashboard.md). Aggregates server-side with indexed queries.
 */
import { db } from "@/lib/mongo";
import { activityService } from "@/services/activity-service";
import { activeWorkspace } from "@/lib/workspace";
import type { User } from "@/lib/types";

export interface DashboardSummary {
  pipelineByStage: Record<string, number>;
  openTasks: number;
  wonThisView: number;
  recentActivity: { entityType: string; kind: string; summary: string; at: Date }[];
}

export const dashboardService = {
  async summary(user: User): Promise<DashboardSummary> {
    const database = await db();
    const ws = await activeWorkspace();

    const stageAgg = await database
      .collection("leads")
      .aggregate<{ _id: string; count: number }>([
        { $match: { orgId: user.orgId, deletedAt: { $exists: false }, workspace: ws } },
        { $group: { _id: "$stage", count: { $sum: 1 } } },
      ])
      .toArray();
    const pipelineByStage: Record<string, number> = {};
    for (const row of stageAgg) pipelineByStage[row._id] = row.count;

    const openTasks = await database
      .collection("tasks")
      .countDocuments({ orgId: user.orgId, status: "open", deletedAt: { $exists: false }, workspace: ws });

    const recent = await activityService.recent(user, 10);

    return {
      pipelineByStage,
      openTasks,
      wonThisView: pipelineByStage["won"] ?? 0,
      recentActivity: recent.map((a) => ({
        entityType: a.entityType,
        kind: a.kind,
        summary: a.summary,
        at: a.createdAt,
      })),
    };
  },
};
