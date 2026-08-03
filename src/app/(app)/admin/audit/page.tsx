import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/iam";
import { auditService } from "@/services/audit-service";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspacePage } from "@/components/ds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const user = await requireUser();
  if (!can(user, "audit.view")) redirect("/home");
  const entries = await auditService.list(user);

  return (
    <WorkspacePage eyebrow="Administration" title="Audit log" subtitle="Immutable, append-only record of important actions." max="max-w-5xl">
      {entries.length === 0 ? (
        <EmptyState title="No audit entries yet" hint="Role changes, deletions, and exports appear here." />
      ) : (
        <div className="glass overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-overlay/[0.03] text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">Actor</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Entity</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-4 py-2 text-muted">{new Date(e.at).toISOString().slice(0, 19).replace("T", " ")}</td>
                  <td className="px-4 py-2 text-muted">{e.actorId}</td>
                  <td className="px-4 py-2 text-fg">{e.action}</td>
                  <td className="px-4 py-2 text-muted">{e.entity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </WorkspacePage>
  );
}
