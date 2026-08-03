import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { uploadService } from "@/services/upload-service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

/** Download the stored file (streamed from GridFS). */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    assertCan(user, "document:read");
    const got = await uploadService.getFileById(user, (await params).id);
    return new Response(new Uint8Array(got.buffer), {
      headers: {
        "Content-Type": got.contentType ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(got.filename)}"`,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    assertCan(user, "document:delete");
    await uploadService.remove(user, (await params).id);
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
