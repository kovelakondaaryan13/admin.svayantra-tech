import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { connectorService } from "@/services/connector-service";
import type { ConnectorKind } from "@/lib/connectors/types";

export const runtime = "nodejs";

/** Test/health-check a connector: refresh token + one live read. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  try {
    const user = await requireUser();
    assertCan(user, "connector:read");
    const { kind } = await params;
    return ok(await connectorService.test(user, kind as ConnectorKind));
  } catch (err) {
    return handleError(err);
  }
}
