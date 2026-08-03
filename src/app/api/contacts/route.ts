import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { ContactCreateSchema } from "@/lib/schemas/entities";
import { contactService } from "@/services/contact-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireUser();
    assertCan(user, "contact:read");
    return ok(await contactService.list(user));
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    assertCan(user, "contact:create");
    const input = ContactCreateSchema.parse(await req.json());
    return ok(await contactService.create(user, input), 201);
  } catch (err) {
    return handleError(err);
  }
}
