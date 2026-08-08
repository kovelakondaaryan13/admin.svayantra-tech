/**
 * EmployeeView — the single computed view-model for a person. Nothing about performance/workload
 * is stored; it's DERIVED from live operational data (leads owned, tasks assigned, meetings held).
 * Pages consume this instead of static fields, so changing the underlying data updates every
 * surface. Ships both a pure `computeFrom` (pass preloaded arrays — for directory/dept rollups
 * without N+1 queries) and a self-loading `forUser`.
 *
 * Requested architecture: "Don't let pages calculate metrics individually — create view models."
 */
import { leadService } from "@/services/lead-service";
import { taskService } from "@/services/task-service";
import { meetingService } from "@/services/meeting-service";
import { slaComplianceByOwner } from "@/services/conveyor-metrics-service";
import { fmtLakhCr as inr } from "@/lib/format";
import { OPEN_LEAD_STAGES } from "@/lib/types";
import type { LeadDTO, User } from "@/lib/types";
import type { DTO, Task, Meeting } from "@/lib/entities";

const OPEN_STAGES: string[] = OPEN_LEAD_STAGES;

export interface EmployeeView {
  openTasks: number;
  overdueTasks: number;
  doneTasks: number;
  meetingsThisMonth: number;
  ownedDeals: number;
  wonDeals: number;
  wonMinor: number;
  pipelineMinor: number;
  capacity?: number;
  overloaded: boolean;
  slaCompliancePct: number | null;
  /** Display KPI chips — all computed, never stored. */
  kpis: { label: string; value: string }[];
}

export interface ViewData {
  leads: LeadDTO[];
  tasks: DTO<Task>[];
  meetings: DTO<Meeting>[];
  /** Precomputed once per data set — computeEmployeeView is called per-employee in bulk
   *  rollups, and slaComplianceByOwner scans every lead, so it must not be redone per call. */
  slaByOwner: Record<string, number | null>;
}

/** Pure: derive one person's view from already-loaded org data. */
export function computeEmployeeView(userId: string, capacity: number | undefined, data: ViewData): EmployeeView {
  const now = Date.now();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const myTasks = data.tasks.filter((t) => t.assigneeId === userId);
  const openTasks = myTasks.filter((t) => t.status === "open");
  const overdueTasks = openTasks.filter((t) => t.dueAt && new Date(t.dueAt).getTime() < now);
  const doneTasks = myTasks.filter((t) => t.status === "done");
  const meetingsThisMonth = data.meetings.filter(
    (m) => m.ownerId === userId && new Date(m.at).getTime() >= monthStart.getTime(),
  ).length;

  const myDeals = data.leads.filter((l) => l.ownerId === userId);
  const won = myDeals.filter((l) => l.stage === "won");
  const wonMinor = won.reduce((s, l) => s + (l.value?.amountMinor ?? 0), 0);
  const pipelineMinor = myDeals
    .filter((l) => OPEN_STAGES.includes(l.stage))
    .reduce((s, l) => s + (l.value?.amountMinor ?? 0), 0);
  const slaCompliancePct = data.slaByOwner[userId] ?? null;

  return {
    openTasks: openTasks.length,
    overdueTasks: overdueTasks.length,
    doneTasks: doneTasks.length,
    meetingsThisMonth,
    ownedDeals: myDeals.length,
    wonDeals: won.length,
    wonMinor,
    pipelineMinor,
    capacity,
    overloaded: typeof capacity === "number" && openTasks.length > capacity,
    slaCompliancePct,
    kpis: [
      { label: "Pipeline", value: inr(pipelineMinor) },
      { label: "Won", value: inr(wonMinor) },
      { label: "Meetings (mo)", value: String(meetingsThisMonth) },
      { label: "Open work", value: String(openTasks.length) },
    ],
  };
}

export const employeeViewService = {
  /** Load org data once and compute a single person's view. */
  async forUser(user: User, targetUserId: string, capacity?: number): Promise<EmployeeView> {
    const data = await employeeViewService.loadData(user);
    return computeEmployeeView(targetUserId, capacity, data);
  },
  /** Load org data once for bulk rollups (directory, department). */
  async loadData(user: User): Promise<ViewData> {
    const [leads, tasks, meetings] = await Promise.all([
      leadService.list(user).catch(() => [] as LeadDTO[]),
      taskService.list(user).catch(() => [] as DTO<Task>[]),
      meetingService.list(user).catch(() => [] as DTO<Meeting>[]),
    ]);
    return { leads, tasks, meetings, slaByOwner: slaComplianceByOwner(leads) };
  },
};
