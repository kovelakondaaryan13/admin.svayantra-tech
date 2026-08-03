import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/iam";
import { WorkspacePage } from "@/components/ds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CARDS = [
  { href: "/admin/organization", label: "Organization", desc: "Structure, departments, teams", icon: "🏢", perm: "org.manage" },
  { href: "/admin/objects", label: "Data models", desc: "Custom records for anything", icon: "🧩", perm: "objects.manage" },
  { href: "/admin/sales-models", label: "Sales models", desc: "Playbooks & conveyor teams", icon: "⚙️", perm: "sales.assign" },
  { href: "/admin/roles", label: "Roles & Permissions", desc: "Who can do what", icon: "🔐", perm: "roles.manage" },
  { href: "/admin/employees", label: "People & Access", desc: "Employees and their roles", icon: "👥", perm: "users.read" },
  { href: "/connectors", label: "Integrations", desc: "Google, Drive, Slack, Notion…", icon: "🔌", perm: "integrations.read" },
  { href: "/admin/timeline", label: "Organization Timeline", desc: "Every structural change", icon: "📈", perm: "audit.view" },
  { href: "/admin/audit", label: "Audit Log", desc: "Immutable activity record", icon: "🧾", perm: "audit.view" },
  { href: "/admin/security", label: "Security", desc: "Password policy, sessions, 2FA", icon: "🔒", perm: "audit.view" },
  { href: "/admin/ai-usage", label: "AI Usage", desc: "Token usage & costs per employee", icon: "🧠", perm: "org.manage" },
  { href: "/admin/settings", label: "Settings", desc: "Organization configuration", icon: "⚡", perm: "org.manage" },
  { href: "/admin/diagnostics", label: "Diagnostics", desc: "Usage, failures & misses", icon: "📊", perm: "org.manage" },
] as const;

export default async function WorkspaceHubPage() {
  const user = await requireUser();
  const cards = CARDS.filter((c) => can(user, c.perm));

  return (
    <WorkspacePage eyebrow="Organization" title="Organization" subtitle="Configure how STOS runs your business — structure, roles, integrations, and audit." max="max-w-4xl">
      {cards.length === 0 ? (
        <div className="glass p-10 text-center">
          <p className="text-sm font-medium text-fg">Nothing to administer here</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
            You don&apos;t have admin access to any workspace settings. Ask STOS if you need
            something changed.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((c) => (
            <Link key={c.href} href={c.href} className="glass glass-hover p-4">
              <div className="text-xl">{c.icon}</div>
              <div className="mt-2 text-sm font-medium text-fg">{c.label}</div>
              <div className="text-xs text-muted">{c.desc}</div>
            </Link>
          ))}
        </div>
      )}
    </WorkspacePage>
  );
}
