import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { DocumentUploadSchema } from "@/lib/schemas/knowledge";
import { documentService } from "@/services/document-service";

export const runtime = "nodejs";
export const maxDuration = 120; // embedding a large document can take time

export async function GET() {
  try {
    const user = await requireUser();
    assertCan(user, "document:read");
    return ok(await documentService.list(user));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    assertCan(user, "document:create");
    const input = DocumentUploadSchema.parse(await req.json());
    return ok(await documentService.upload(user, input), 201);
  } catch (err) {
    return handleError(err);
  }
}
