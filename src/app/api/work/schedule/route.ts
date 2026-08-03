import { requireUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ok, handleError } from "@/lib/http";
import { taskService } from "@/services/task-service";
import { calendarService } from "@/services/calendar-service";
import { connectorStatuses } from "@/lib/connectors/credentials";

export const runtime = "nodejs";

const BLOCK_MINUTES = 30;

/**
 * Auto-schedule the caller's open, dated tasks into Google Calendar. Degrades gracefully:
 * if Google is not connected we return `{ connected: false }` instead of erroring, so the
 * UI can prompt the user to connect rather than showing a 500.
 */
export async function POST() {
  try {
    const user = await requireUser();
    assertCan(user, "calendar:write");

    const statuses = await connectorStatuses(user);
    const connected = statuses.some(
      (s) => s.kind === "google_calendar" && s.status === "connected",
    );
    if (!connected) {
      return ok({ connected: false, scheduled: 0 });
    }

    const tasks = await taskService.listScoped(user, "mine");
    const dated = tasks.filter((t) => t.status === "open" && t.dueAt);

    let scheduled = 0;
    const failures: string[] = [];
    for (const t of dated) {
      const start = new Date(t.dueAt as unknown as string);
      const end = new Date(start.getTime() + BLOCK_MINUTES * 60_000);
      try {
        await calendarService.create(user, {
          title: `STOS · ${t.title}`,
          description: `Auto-scheduled by STOS from your Work tasks.${t.leadId ? ` Lead: ${t.leadId}` : ""}`,
          start: start.toISOString(),
          end: end.toISOString(),
        });
        scheduled += 1;
      } catch {
        failures.push(t.title);
      }
    }

    return ok({ connected: true, scheduled, considered: dated.length, failures });
  } catch (err) {
    return handleError(err);
  }
}
