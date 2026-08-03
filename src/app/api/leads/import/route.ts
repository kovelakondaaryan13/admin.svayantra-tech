import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { BusinessRule } from "@/lib/errors";
import { leadImportService } from "@/services/lead-import-service";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

/** Step 1: upload a CSV/XLSX/XLS file, parse it, and let AI detect the column mapping. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new BusinessRule("no file provided");
    if (file.size > MAX_BYTES) throw new BusinessRule("file exceeds the 10MB limit");
    const buffer = Buffer.from(await file.arrayBuffer());
    const preview = await leadImportService.preview(user, buffer, file.name);
    return ok(preview);
  } catch (err) {
    return handleError(err);
  }
}
