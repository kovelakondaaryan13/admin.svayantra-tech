import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { CalendarEventUpdateSchema } from "@/lib/schemas/knowledge";
import { calendarService } from "@/services/calendar-service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    assertCan(user, "calendar:write");
    const patch = CalendarEventUpdateSchema.parse(await req.json());
    return ok(await calendarService.update(user, (await params).id, patch));
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    assertCan(user, "calendar:write");
    await calendarService.remove(user, (await params).id);
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
