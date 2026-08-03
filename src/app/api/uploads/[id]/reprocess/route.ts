import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { uploadService } from "@/services/upload-service";

export const runtime = "nodejs";
export const maxDuration = 60;
type Params = { params: Promise<{ id: string }> };

/** Retry the ingestion pipeline for a failed/stuck file. */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    assertCan(user, "document:create");
    return ok(await uploadService.reprocess(user, (await params).id));
  } catch (err) {
    return handleError(err);
  }
}
