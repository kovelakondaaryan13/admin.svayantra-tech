import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { CompanyCreateSchema } from "@/lib/schemas/entities";
import { companyService } from "@/services/company-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    assertCan(user, "company:read");
    return ok(await companyService.list(user));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    assertCan(user, "company:create");
    const input = CompanyCreateSchema.parse(await req.json());
    return ok(await companyService.create(user, input), 201);
  } catch (err) {
    return handleError(err);
  }
}
