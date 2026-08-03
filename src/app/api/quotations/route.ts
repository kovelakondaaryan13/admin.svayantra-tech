import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { QuotationCreateSchema } from "@/lib/schemas/entities";
import { quotationService } from "@/services/quotation-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    assertCan(user, "quotation:read");
    return ok(await quotationService.list(user));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    assertCan(user, "quotation:create");
    const input = QuotationCreateSchema.parse(await req.json());
    return ok(await quotationService.create(user, input), 201);
  } catch (err) {
    return handleError(err);
  }
}
