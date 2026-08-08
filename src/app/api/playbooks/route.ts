import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { playbookService } from "@/services/playbook-service";
import { PlaybookCreateSchema } from "@/lib/schemas/platform";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await playbookService.list(user));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = PlaybookCreateSchema.parse(await req.json());
    return ok(await playbookService.create(user, input), 201);
  } catch (err) {
    return handleError(err);
  }
}
