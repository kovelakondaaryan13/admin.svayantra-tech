import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/iam";
import { playbookService } from "@/services/playbook-service";
import { conveyorTeamService } from "@/services/conveyor-team-service";
import { employeeService } from "@/services/employee-service";
import { SalesModelsAdmin } from "@/components/admin/sales-models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SalesModelsPage() {
  const user = await requireUser();
  const canPlaybooks = can(user, "workflows.manage");
  const canTeams = can(user, "sales.assign");
  if (!canPlaybooks && !canTeams) redirect("/home");

  const [playbooks, teams, employees] = await Promise.all([
    playbookService.list(user).catch(() => []),
    conveyorTeamService.list(user).catch(() => []),
    employeeService.list(user).catch(() => []),
  ]);

  return (
    <SalesModelsAdmin
      canPlaybooks={canPlaybooks}
      canTeams={canTeams}
      playbooks={playbooks.map((p) => ({
        id: p.id,
        key: p.key,
        label: p.label,
        model: p.model,
        description: p.description,
        stageCount: p.stages.length,
        stageLabels: p.stages.map((s) => s.label),
        kpis: p.kpis,
        enabled: p.enabled,
      }))}
      teams={teams.map((t) => ({
        id: t.id,
        name: t.name,
        memberUserIds: t.memberUserIds,
        playbookKey: t.playbookKey,
      }))}
      employees={employees
        .filter((e) => e.status === "active")
        .map((e) => ({ userId: e.userId, name: e.name }))}
    />
  );
}
