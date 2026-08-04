import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can, assignableRoles } from "@/lib/iam";
import { employeeService } from "@/services/employee-service";
import { orgUnitService } from "@/services/org-unit-service";
import { EmployeesTable } from "@/components/admin/employees-table";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const user = await requireUser();
  if (!can(user, "users.read")) redirect("/home");
  const [employees, units] = await Promise.all([
    employeeService.list(user),
    orgUnitService.list(user).catch(() => []),
  ]);
  const departments = units
    .filter((u) => u.type === "department")
    .map((u) => ({ id: u.id, name: u.name }));

  return (
    <EmployeesTable
      canEdit={can(user, "users.edit")}
      allowCreate={can(user, "users.edit")}
      roleOptions={assignableRoles(user).map((r) => ({ key: r.key, label: r.label }))}
      departments={departments}
      managers={employees.map((e) => ({ userId: e.userId, name: e.name }))}
      employees={employees.map((e) => ({
        id: e.id,
        name: e.name,
        email: e.email,
        personalEmail: e.personalEmail,
        roleKey: e.roleKey,
        status: e.status,
        title: e.title,
        departmentId: e.departmentId,
        managerUserId: e.managerUserId,
        capacity: e.capacity,
        defaultExecutionModel: e.defaultExecutionModel,
      }))}
    />
  );
}
