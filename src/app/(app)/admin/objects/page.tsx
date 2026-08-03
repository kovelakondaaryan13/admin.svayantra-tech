import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/iam";
import { objectDefinitionService } from "@/services/object-definition-service";
import { ObjectsPanel } from "@/components/admin/objects-panel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ObjectsPage() {
  const user = await requireUser();
  if (!can(user, "objects.read")) redirect("/home");
  const defs = await objectDefinitionService.list(user);
  return (
    <ObjectsPanel
      canManage={can(user, "objects.manage")}
      defs={defs.map((d) => ({
        id: d.id,
        key: d.key,
        label: d.label,
        labelPlural: d.labelPlural,
        displayField: d.displayField,
        fields: d.fields.map((f) => ({ key: f.key, label: f.label, type: f.type })),
      }))}
    />
  );
}
