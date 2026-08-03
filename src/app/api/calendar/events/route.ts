import type { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { CalendarEventSchema } from "@/lib/schemas/knowledge";
import { calendarService } from "@/services/calendar-service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    assertCan(user, "calendar:read");
    const url = new URL(req.url);
    return ok(
      await calendarService.list(user, {
        timeMin: url.searchParams.get("timeMin") ?? undefined,
        timeMax: url.searchParams.get("timeMax") ?? undefined,
        max: Number(url.searchParams.get("max") ?? "25"),
      }),
    );
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    assertCan(user, "calendar:write");
    const event = CalendarEventSchema.parse(await req.json());
    return ok(await calendarService.create(user, event), 201);
  } catch (err) {
    return handleError(err);
  }
}
