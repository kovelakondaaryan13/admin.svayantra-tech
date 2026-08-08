import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError } from "@/lib/http";
import { IssueCreateSchema } from "@/lib/schemas/entities";
import { issueService } from "@/services/issue-service";

export const runtime = "nodejs";

/** Any authenticated user can raise an issue and see the issues they raised/own. */
export async function GET() {
  try {
    const user = await requireUser();
    return ok(await issueService.list(user));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = IssueCreateSchema.parse(await req.json());
    return ok(await issueService.create(user, input), 201);
  } catch (err) {
    return handleError(err);
  }
}
