import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { LeadCreateSchema } from "@/lib/schemas/lead";
import { leadService } from "@/services/lead-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    assertCan(user, "lead:read");
    const data = await leadService.list(user);
    return ok(data);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    assertCan(user, "lead:create");
    const input = LeadCreateSchema.parse(await req.json());
    const lead = await leadService.create(input, { user });
    return ok(lead, 201);
  } catch (err) {
    return handleError(err);
  }
}
