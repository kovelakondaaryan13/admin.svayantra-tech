import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { RecordSchema } from "@/lib/schemas/platform";
import { recordService } from "@/services/record-service";

export const runtime = "nodejs";
export const maxDuration = 60;
type Params = { params: Promise<{ type: string; id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const p = await params;
    return ok(await recordService.get(user, p.type, p.id));
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const p = await params;
    const { data } = RecordSchema.parse(await req.json());
    return ok(await recordService.update(user, p.type, p.id, data));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const p = await params;
    await recordService.remove(user, p.type, p.id);
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
