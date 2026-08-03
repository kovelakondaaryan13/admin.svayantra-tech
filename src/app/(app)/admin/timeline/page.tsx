import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/iam";
import { auditService } from "@/services/audit-service";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkspacePage } from "@/components/ds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRUCTURAL = /^(orgunit|role|object|workflow|policy|permission|employee)\./;

export default async function TimelinePage() {
  const user = await requireUser();
  if (!can(user, "audit.view")) redirect("/home");
  const entries = (await auditService.list(user, 300)).filter((e) => STRUCTURAL.test(e.action));

  return (
    <WorkspacePage eyebrow="Administration" title="Organization timeline" subtitle="Every structural change, from the immutable audit log." max="max-w-3xl">
      {entries.length === 0 ? (
        <EmptyState title="No structural changes yet" hint="Creating units, roles, objects, or policies appears here." />
      ) : (
        <ol className="relative space-y-3 border-l border-border pl-5">
          {entries.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[23px] top-1.5 h-2 w-2 rounded-full bg-accent" />
              <div className="text-sm text-fg">{e.action.replace(/\./g, " · ")}</div>
              <div className="text-xs text-muted">
                {new Date(e.at).toISOString().slice(0, 19).replace("T", " ")} · {e.actorId}
              </div>
            </li>
          ))}
        </ol>
      )}
    </WorkspacePage>
  );
}
