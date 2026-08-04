import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { meetingService } from "@/services/meeting-service";
import { taskService } from "@/services/task-service";
import { calendarService } from "@/services/calendar-service";
import { connectorStatuses } from "@/lib/connectors/credentials";
import { fmtDateTime } from "@/lib/format";
import { PageHeader, Section } from "@/components/ds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AgendaItem {
  id: string;
  title: string;
  at: Date;
  kind: "meeting" | "task" | "google";
  href?: string;
  meta: string;
}

const ICON: Record<AgendaItem["kind"], string> = { meeting: "📅", task: "✅", google: "🗓️" };
const BUCKET_ORDER = ["Overdue", "Today", "Tomorrow", "This week", "Later"];

function bucketLabel(at: Date, now: Date): string {
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((dayStart(at) - dayStart(now)) / 86400000);
  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays <= 7) return "This week";
  return "Later";
}

export default async function CalendarPage() {
  const user = await requireUser();
  const now = new Date();
  const horizon = new Date(now.getTime() + 30 * 86400000);

  const [meetings, myTasks, statuses] = await Promise.all([
    meetingService.list(user).catch(() => []),
    taskService.listScoped(user, "mine").catch(() => []),
    connectorStatuses(user).catch(() => []),
  ]);

  const googleConnected = statuses.some((s) => s.kind === "google_calendar" && s.status === "connected");
  const googleEvents = googleConnected
    ? await calendarService
        .list(user, { timeMin: now.toISOString(), timeMax: horizon.toISOString(), max: 50 })
        .catch(() => [])
    : [];

  const myMeetings = meetings.filter((m) => m.ownerId === user.id);
  // Events already shown via a synced meeting/task shouldn't also show as a raw Google entry.
  const syncedIds = new Set(
    [...myMeetings.map((m) => m.googleEventId), ...myTasks.map((t) => t.googleEventId)].filter(Boolean) as string[],
  );

  const items: AgendaItem[] = [
    ...myMeetings.map((m) => ({
      id: m.id,
      title: m.title,
      at: new Date(m.at),
      kind: "meeting" as const,
      href: m.leadId ? `/work/${m.leadId}` : undefined,
      meta: "Meeting",
    })),
    ...myTasks
      .filter((t) => t.status === "open" && t.dueAt)
      .map((t) => ({
        id: t.id,
        title: t.title,
        at: new Date(t.dueAt!),
        kind: "task" as const,
        href: t.leadId ? `/work/${t.leadId}` : "/work/tasks",
        meta: `Task${t.priority ? ` · ${t.priority}` : ""}`,
      })),
    ...googleEvents
      .filter((e) => !syncedIds.has(e.id))
      .map((e) => ({ id: e.id, title: e.title, at: new Date(e.start), kind: "google" as const, meta: "Google Calendar" })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  const groups = new Map<string, AgendaItem[]>();
  for (const item of items) {
    const label = bucketLabel(item.at, now);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(item);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        eyebrow="Calendar"
        title="Your calendar"
        subtitle={
          googleConnected
            ? "Meetings, tasks, and everything on your connected Google Calendar."
            : "Meetings and tasks with due dates."
        }
      />

      {!googleConnected && (
        <div className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-fg/90">
          <Link href="/account" className="text-accent hover:underline">Connect Google Calendar</Link> in your account
          to see everything in one place — and to let STOS put meetings and tasks it books straight on your calendar.
        </div>
      )}

      {items.length === 0 ? (
        <Section variant="plain">
          <p className="px-2 py-8 text-center text-sm text-muted">
            Nothing scheduled. Ask STOS to book a meeting or set a task due date.
          </p>
        </Section>
      ) : (
        BUCKET_ORDER.filter((label) => groups.has(label)).map((label) => (
          <Section key={label} title={`${label} (${groups.get(label)!.length})`}>
            <div className="space-y-1">
              {groups.get(label)!.map((item) => {
                const row = (
                  <div className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-overlay/[0.03]">
                    <div className="flex min-w-0 items-center gap-2">
                      <span aria-hidden>{ICON[item.kind]}</span>
                      <span className="truncate text-sm text-fg">{item.title}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs text-muted">
                      <span>{item.meta}</span>
                      <span>{fmtDateTime(item.at)}</span>
                    </div>
                  </div>
                );
                return item.href ? (
                  <Link key={`${item.kind}-${item.id}`} href={item.href} className="block">{row}</Link>
                ) : (
                  <div key={`${item.kind}-${item.id}`}>{row}</div>
                );
              })}
            </div>
          </Section>
        ))
      )}
    </div>
  );
}
