import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { leadImportService } from "@/services/lead-import-service";

export const runtime = "nodejs";
export const maxDuration = 60;

const CommitSchema = z.object({
  rows: z.array(z.record(z.string())).min(1).max(2000),
  mapping: z.object({
    name: z.string().nullable(),
    email: z.string().nullable(),
    company: z.string().nullable(),
    value: z.string().nullable(),
    source: z.string().nullable(),
    notes: z.string().nullable(),
    currency: z.enum(["INR", "USD"]),
    valueUnit: z.enum(["whole", "minor"]),
  }),
});

/** Step 2: create a lead for each row using the (possibly rep-corrected) column mapping. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { rows, mapping } = CommitSchema.parse(await req.json());
    const result = await leadImportService.commit(user, rows, mapping);
    return ok(result, 201);
  } catch (err) {
    return handleError(err);
  }
}
