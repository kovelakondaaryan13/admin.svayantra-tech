import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { RecordSchema } from "@/lib/schemas/platform";
import { recordService } from "@/services/record-service";

export const runtime = "nodejs";
export const maxDuration = 60; // AI indexing on create
type Params = { params: Promise<{ type: string }> };

/** Generic list/create for ANY custom object type — metadata-driven, no per-object code. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    return ok(await recordService.list(user, (await params).type));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const { data } = RecordSchema.parse(await req.json());
    return ok(await recordService.create(user, (await params).type, data), 201);
  } catch (err) {
    return handleError(err);
  }
}
