import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can, isOwner } from "@/lib/iam";
import { taskService, type WorkScope } from "@/services/task-service";
import { employeeService } from "@/services/employee-service";
import { WorkTabs } from "@/components/work/work-tabs";
import { TasksWorkspace } from "@/components/work/tasks-workspace";
import { CollectionPage } from "@/components/ds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const user = await requireUser();
  if (!can(user, "crm.read") && !can(user, "tasks.assign")) redirect("/home");

  // Available scopes escalate with permission.
  const scopes: WorkScope[] = ["mine"];
  if (can(user, "users.read")) scopes.push("team");
  if (isOwner(user)) scopes.push("all");

  const initial = await taskService.listScoped(user, scopes[0]);
  const employees = can(user, "users.read")
    ? await employeeService.list(user).catch(() => [])
    : [];
  const nameById: Record<string, string> = {};
  const capacityById: Record<string, number> = {};
  for (const e of employees) {
    nameById[e.userId] = e.name;
    if (typeof e.capacity === "number") capacityById[e.userId] = e.capacity;
  }
  // Always resolve the caller's own name so "My Work" workload has a label.
  if (!nameById[user.id]) nameById[user.id] = user.name ?? user.email;

  return (
    <CollectionPage
      eyebrow="Work"
      title="My Work"
      subtitle="Your work, orchestrated by STOS — priorities, overdue items, and what to do next."
      tabs={<WorkTabs showConveyor={can(user, "users.read")} />}
    >
      <TasksWorkspace
        scopes={scopes}
        nameById={nameById}
        capacityById={capacityById}
        currentUserId={user.id}
        initial={initial.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueAt: t.dueAt ? new Date(t.dueAt).toISOString() : undefined,
          assigneeId: t.assigneeId,
          leadId: t.leadId,
        }))}
      />
    </CollectionPage>
  );
}
