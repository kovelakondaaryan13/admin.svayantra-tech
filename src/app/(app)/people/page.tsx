import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can, assignableRoles } from "@/lib/iam";
import { employeeService } from "@/services/employee-service";
import { employeeViewService, computeEmployeeView } from "@/services/employee-view-service";
import { EmployeesTable } from "@/components/admin/employees-table";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const user = await requireUser();
  if (!can(user, "users.read")) redirect("/home");
  const [employees, viewData] = await Promise.all([
    employeeService.list(user),
    employeeViewService.loadData(user),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <EmployeesTable
        title="People"
        subtitle="Everyone in your organization. Click a role to change it."
        canEdit={can(user, "users.edit")}
        roleOptions={assignableRoles(user).map((r) => ({ key: r.key, label: r.label }))}
        employees={employees.map((e) => ({
          id: e.id,
          name: e.name,
          email: e.email,
          personalEmail: e.personalEmail,
          roleKey: e.roleKey,
          status: e.status,
          title: e.title,
          kpis: computeEmployeeView(e.userId, e.capacity, viewData).kpis,
        }))}
      />
    </div>
  );
}
