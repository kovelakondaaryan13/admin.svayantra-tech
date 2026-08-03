import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { BusinessRule } from "@/lib/errors";
import { uploadService } from "@/services/upload-service";
import type { RelatedObject } from "@/lib/chat-entities";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

/** Upload one or more files (multipart). Returns immediately after GridFS store; ingestion runs
 *  async. Optional `related` (JSON) links the uploads to an object (company/person/lead/meeting). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    assertCan(user, "document:create");
    const form = await req.formData();
    const files = form.getAll("file").filter((f): f is File => f instanceof File);
    if (files.length === 0) throw new BusinessRule("no file provided");

    let related: RelatedObject[] | undefined;
    const relatedRaw = form.get("related");
    if (typeof relatedRaw === "string") {
      try { related = JSON.parse(relatedRaw); } catch { /* ignore malformed */ }
    }

    const out = [];
    for (const f of files) {
      if (f.size > MAX_BYTES) throw new BusinessRule(`"${f.name}" exceeds the 25MB limit`);
      const buffer = Buffer.from(await f.arrayBuffer());
      out.push(await uploadService.upload(user, { buffer, name: f.name, mimeType: f.type || undefined, related }));
    }
    return ok({ files: out }, 201);
  } catch (err) {
    return handleError(err);
  }
}

/** List uploaded files with ingestion status. Optional `?relatedType=&relatedId=` filter. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    assertCan(user, "document:read");
    const url = new URL(req.url);
    return ok(await uploadService.list(user, {
      relatedType: url.searchParams.get("relatedType") ?? undefined,
      relatedId: url.searchParams.get("relatedId") ?? undefined,
    }));
  } catch (err) {
    return handleError(err);
  }
}
