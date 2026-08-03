import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/iam";
import { orgUnitService } from "@/services/org-unit-service";
import { employeeService } from "@/services/employee-service";
import { employeeViewService } from "@/services/employee-view-service";
import { OrgConsole } from "@/components/admin/org-console";
import { DepartmentKpis } from "@/components/admin/department-kpis";
import { PageHeader } from "@/components/ds";
import { fmtLakhCr as inr } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPEN_STAGES = ["new", "qualified", "meeting", "proposal", "negotiation"];

export default async function OrganizationPage() {
  const user = await requireUser();
  const canRead = can(user, "users.read");
  const [units, fullEmployees, viewData] = await Promise.all([
    orgUnitService.listWithStats(user),
    canRead ? employeeService.list(user).catch(() => []) : Promise.resolve([]),
    canRead ? employeeViewService.loadData(user) : Promise.resolve({ leads: [], tasks: [], meetings: [] }),
  ]);
  const canEdit = can(user, "org.manage");
  if (!canEdit) redirect("/home");

  const employees = fullEmployees.map((e) => ({ userId: e.userId, name: e.name }));

  // Department KPIs are COMPUTED from members' live data — never stored.
  const deptKpis = (deptId: string) => {
    const members = new Set(fullEmployees.filter((e) => e.departmentId === deptId).map((e) => e.userId));
    if (members.size === 0) return [];
    let pipeline = 0, won = 0, openWork = 0;
    for (const l of viewData.leads) {
      if (!members.has(l.ownerId)) continue;
      if (OPEN_STAGES.includes(l.stage)) pipeline += l.value?.amountMinor ?? 0;
      if (l.stage === "won") won += l.value?.amountMinor ?? 0;
    }
    for (const t of viewData.tasks) if (t.status === "open" && members.has(t.assigneeId)) openWork += 1;
    return [
      { label: "Pipeline", value: inr(pipeline) },
      { label: "Won", value: inr(won) },
      { label: "Open work", value: String(openWork) },
    ];
  };

  const departments = units
    .filter((u) => u.type === "department")
    .map((u) => {
      const meta = (u.metadata ?? {}) as { resources?: string[] };
      return {
        id: u.id,
        name: u.name,
        managerName: u.managerName,
        memberCount: u.memberCount,
        headcountCapacity: u.headcountCapacity,
        kpis: deptKpis(u.id), // computed
        resources: Array.isArray(meta.resources) ? meta.resources : [], // config, not a metric
      };
    });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader eyebrow="Organization" title="Structure" subtitle="Departments, teams, capacity, and reporting lines." />
      <DepartmentKpis departments={departments} />
      <OrgConsole
      canEdit={canEdit}
      employees={employees}
      units={units.map((u) => ({
        id: u.id,
        name: u.name,
        type: u.type,
        parentId: u.parentId ?? null,
        managerUserId: u.managerUserId ?? null,
        managerName: u.managerName,
        memberCount: u.memberCount,
        headcountCapacity: u.headcountCapacity,
        vacancies: u.vacancies,
      }))}
      />
    </div>
  );
}
