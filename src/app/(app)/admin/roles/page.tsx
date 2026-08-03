import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can, PERMISSION_DOMAINS } from "@/lib/iam";
import { roleService } from "@/services/role-service";
import { RolesMatrix } from "@/components/admin/roles-matrix";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const user = await requireUser();
  if (!can(user, "roles.manage")) redirect("/home");
  const { system, custom } = await roleService.list(user);

  return (
    <RolesMatrix
      domains={PERMISSION_DOMAINS}
      system={system.map((r) => ({ key: r.key, label: r.label, permissions: [...r.permissions] }))}
      custom={custom.map((c) => ({ id: c.id, key: c.key, label: c.label, permissions: c.permissions }))}
    />
  );
}
