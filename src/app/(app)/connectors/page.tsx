import { requireUser } from "@/lib/auth";
import { can } from "@/lib/iam";
import { connectorRegistry } from "@/lib/connectors/registry";
import { connectorStatuses } from "@/lib/connectors/credentials";
import { ConnectorsPanel } from "@/components/connectors/panel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ConnectorsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const statuses = await connectorStatuses(user);
  const byKind = new Map(statuses.map((s) => [s.kind, s]));

  const items = connectorRegistry.map((c) => {
    const s = byKind.get(c.kind);
    return {
      kind: c.kind,
      label: c.label,
      category: c.category,
      availability: c.availability,
      connected: s?.status === "connected",
      status: s?.status ?? null,
      accountEmail: s?.accountEmail ?? null,
      lastSyncedAt: s?.lastSyncedAt ? new Date(s.lastSyncedAt).toISOString() : null,
    };
  });

  return (
    <ConnectorsPanel
      items={items}
      connected={sp.connected}
      error={sp.error}
      canManageGoogle={can(user, "calendar.write")}
      canTestGoogle={can(user, "integrations.read")}
    />
  );
}
