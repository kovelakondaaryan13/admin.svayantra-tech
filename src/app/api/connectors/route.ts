import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { connectorRegistry } from "@/lib/connectors/registry";
import { connectorStatuses } from "@/lib/connectors/credentials";

export const runtime = "nodejs";

/** Catalog of connectors + this user's connection status for each. */
export async function GET() {
  try {
    const user = await requireUser();
    assertCan(user, "connector:read");
    const statuses = await connectorStatuses(user);
    const byKind = new Map(statuses.map((s) => [s.kind, s]));
    return ok(
      connectorRegistry.map((c) => ({
        kind: c.kind,
        label: c.label,
        category: c.category,
        availability: c.availability,
        connection: byKind.get(c.kind) ?? null,
      })),
    );
  } catch (err) {
    return handleError(err);
  }
}
