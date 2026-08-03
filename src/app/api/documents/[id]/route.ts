import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { documentService } from "@/services/document-service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    assertCan(user, "document:read");
    return ok(await documentService.get(user, (await params).id));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    assertCan(user, "document:delete");
    await documentService.remove(user, (await params).id);
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
