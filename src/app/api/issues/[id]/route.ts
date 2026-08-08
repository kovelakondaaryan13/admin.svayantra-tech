import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { IssueUpdateSchema } from "@/lib/schemas/entities";
import { issueService } from "@/services/issue-service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    return ok(await issueService.get(user, (await params).id));
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const input = IssueUpdateSchema.parse(await req.json());
    return ok(await issueService.update(user, (await params).id, input));
  } catch (err) {
    return handleError(err);
  }
}
