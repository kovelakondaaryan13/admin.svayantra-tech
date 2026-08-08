"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WorkScope } from "@/services/task-service";
import { fmtDate } from "@/lib/format";
import { composeScore, workloadIdealnessSignal, capacityHeadroomSignal, taskCompletionSignal, reliabilitySignal, orgMedianCapacity } from "@/lib/employee-score";

interface TaskRow {
  id: string;
  title: string;
  status: "open" | "done";
  priority?: "low" | "medium" | "high";
  dueAt?: string;
  assigneeId: string;
  leadId?: string;
}

type ViewMode = "list" | "board" | "calendar" | "workload";

const SCOPE_LABEL: Record<WorkScope, string> = { mine: "My Work", team: "Team Work", all: "All Work" };
const PRIORITY_COLOR: Record<string, string> = { high: "text-action", medium: "text-accent", low: "text-muted" };
const VIEWS: { key: ViewMode; label: string }[] = [
  { key: "list", label: "List" },
  { key: "board", label: "Board" },
  { key: "calendar", label: "Calendar" },
  { key: "workload", label: "Workload" },
];

function overdue(t: TaskRow) {
  return t.status === "open" && t.dueAt && new Date(t.dueAt).getTime() < Date.now();
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function TasksWorkspace({
  scopes,
  initial,
  nameById,
  capacityById,
  currentUserId,
}: {
  scopes: WorkScope[];
  initial: TaskRow[];
  nameById: Record<string, string>;
  capacityById: Record<string, number>;
  currentUserId: string;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<WorkScope>(scopes[0] ?? "mine");
  const [view, setView] = useState<ViewMode>("list");
  const [tasks, setTasks] = useState<TaskRow[]>(initial);
  const [loading, setLoading] = useState(false);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefing_busy, setBriefingBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);

  async function generateBriefing() {
    setBriefingBusy(true);
    try {
      const res = await fetch("/api/work/briefing", { method: "POST" });
      const b = await res.json();
      setBriefing(res.ok ? b.data.briefing : b?.error ?? "Failed to generate briefing.");
    } finally {
      setBriefingBusy(false);
    }
  }

  async function syncToGoogle() {
    setSyncBusy(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/work/schedule", { method: "POST" });
      const b = await res.json();
      if (!res.ok) {
        setSyncMsg(b?.error ?? "Could not sync to Google Calendar.");
      } else if (!b.data.connected) {
        setSyncMsg("Google Calendar isn't connected. Connect it in Workspace › Integrations first.");
      } else {
        setSyncMsg(
          `Scheduled ${b.data.scheduled} of ${b.data.considered} due task${b.data.considered === 1 ? "" : "s"} into Google Calendar.`,
        );
      }
    } finally {
      setSyncBusy(false);
    }
  }

  useEffect(() => {
    if (scope === scopes[0]) {
      setTasks(initial);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/tasks?scope=${scope}`)
      .then((r) => r.json())
      .then((b) => {
        if (!cancelled) setTasks(b.data ?? []);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle(t: TaskRow) {
    const next = t.status === "done" ? "open" : "done";
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
    const res = await fetch(`/api/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, status: t.status } : x)));
    router.refresh();
  }

  /** Drag-and-drop in the calendar view — moves a task to a new day, keeping its time-of-day. */
  async function moveTaskDate(t: TaskRow, day: Date) {
    const prevDueAt = t.dueAt;
    const next = new Date(day);
    if (t.dueAt) { const old = new Date(t.dueAt); next.setHours(old.getHours(), old.getMinutes(), 0, 0); }
    else next.setHours(9, 0, 0, 0);
    const nextIso = next.toISOString();
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, dueAt: nextIso } : x)));
    const res = await fetch(`/api/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueAt: nextIso }),
    });
    if (!res.ok) setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, dueAt: prevDueAt } : x)));
    router.refresh();
  }

  const open = tasks.filter((t) => t.status === "open");
  const done = tasks.filter((t) => t.status === "done");
  const overdueCount = open.filter(overdue).length;
  const showAssignee = scope !== "mine";
  const cardProps = { onToggle: toggle, showAssignee, nameById };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-overlay/[0.03] p-0.5">
          {scopes.map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                scope === s ? "bg-overlay/10 text-fg" : "text-muted hover:text-fg"
              }`}
            >
              {SCOPE_LABEL[s]}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted">
          {open.length} open{overdueCount > 0 ? ` · ${overdueCount} overdue` : ""}
        </span>
        <button
          onClick={generateBriefing}
          disabled={briefing_busy}
          className="btn-action ml-auto px-3 py-1.5 text-xs"
        >
          {briefing_busy ? "Thinking…" : "Plan my day with STOS"}
        </button>
      </div>

      {/* View switcher */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-overlay/[0.03] p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                view === v.key ? "bg-overlay/10 text-fg" : "text-muted hover:text-fg"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        {view === "calendar" && (
          <button onClick={syncToGoogle} disabled={syncBusy} className="btn-ghost text-xs">
            {syncBusy ? "Syncing…" : "Sync due tasks → Google Calendar"}
          </button>
        )}
      </div>

      {syncMsg && view === "calendar" && (
        <div className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-fg/90">
          {syncMsg}
        </div>
      )}

      {briefing && (
        <section className="glass p-4">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-medium text-fg">STOS daily briefing</h2>
            <button onClick={() => setBriefing(null)} className="text-xs text-muted hover:text-fg">dismiss</button>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg/90">{briefing}</p>
        </section>
      )}

      {loading ? (
        <div className="glass p-8 text-center text-sm text-muted">Loading…</div>
      ) : view === "list" ? (
        <ListView open={open} done={done} {...cardProps} />
      ) : view === "board" ? (
        <BoardView open={open} {...cardProps} />
      ) : view === "calendar" ? (
        <CalendarView open={open} done={done} onMove={moveTaskDate} {...cardProps} />
      ) : (
        <WorkloadView
          open={open}
          done={done}
          nameById={nameById}
          capacityById={capacityById}
          currentUserId={currentUserId}
          scope={scope}
        />
      )}
    </div>
  );
}

type CardProps = {
  onToggle: (t: TaskRow) => void;
  showAssignee: boolean;
  nameById: Record<string, string>;
};

function ListView({ open, done, ...cardProps }: { open: TaskRow[]; done: TaskRow[] } & CardProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Column title={`Open (${open.length})`}>
        {open.length === 0 ? (
          <Empty text="Nothing open. Ask STOS to plan your day." />
        ) : (
          open.map((t) => <TaskCard key={t.id} t={t} {...cardProps} />)
        )}
      </Column>
      <Column title={`Done (${done.length})`}>
        {done.length === 0 ? (
          <Empty text="Completed work shows here." />
        ) : (
          done.map((t) => <TaskCard key={t.id} t={t} {...cardProps} />)
        )}
      </Column>
    </div>
  );
}

const PRIORITY_COLUMNS: { key: string; label: string }[] = [
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
  { key: "none", label: "Unprioritized" },
];

function BoardView({ open, ...cardProps }: { open: TaskRow[] } & CardProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {PRIORITY_COLUMNS.map((col) => {
        const items = open.filter((t) => (t.priority ?? "none") === col.key);
        return (
          <Column key={col.key} title={`${col.label} (${items.length})`}>
            {items.length === 0 ? (
              <Empty text="—" />
            ) : (
              items.map((t) => <TaskCard key={t.id} t={t} {...cardProps} />)
            )}
          </Column>
        );
      })}
    </div>
  );
}

type CalScope = "month" | "week" | "day";
const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_LABEL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function daysForRange(scope: CalScope, anchor: Date): Date[] {
  if (scope === "day") return [startOfDay(anchor)];
  if (scope === "week") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - anchor.getDay());
    return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

function rangeLabel(scope: CalScope, anchor: Date): string {
  if (scope === "month") return `${MONTH_LABEL[anchor.getMonth()]} ${anchor.getFullYear()}`;
  if (scope === "day") return `${WEEKDAY_FULL[anchor.getDay()]}, ${MONTH_LABEL[anchor.getMonth()]} ${anchor.getDate()}`;
  const [start, end] = [daysForRange("week", anchor)[0], daysForRange("week", anchor)[6]];
  return `${MONTH_LABEL[start.getMonth()].slice(0, 3)} ${start.getDate()} – ${MONTH_LABEL[end.getMonth()].slice(0, 3)} ${end.getDate()}, ${end.getFullYear()}`;
}

function CalendarView({
  open,
  done,
  onMove,
  ...cardProps
}: { open: TaskRow[]; done: TaskRow[]; onMove: (t: TaskRow, day: Date) => void } & CardProps) {
  const [scope, setScope] = useState<CalScope>("month");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));

  const all = [...open, ...done];
  const dated = all.filter((t) => t.dueAt);
  const undated = open.filter((t) => !t.dueAt);
  const byDay = new Map<string, TaskRow[]>();
  for (const t of dated) {
    const key = startOfDay(new Date(t.dueAt!)).toDateString();
    byDay.set(key, [...(byDay.get(key) ?? []), t]);
  }

  const days = daysForRange(scope, anchor);
  const maxPerCell = scope === "day" ? 40 : scope === "week" ? 6 : 3;
  const todayKey = startOfDay(new Date()).toDateString();

  function shift(dir: 1 | -1) {
    setAnchor((a) => {
      const next = new Date(a);
      if (scope === "month") next.setMonth(next.getMonth() + dir);
      else if (scope === "week") next.setDate(next.getDate() + dir * 7);
      else next.setDate(next.getDate() + dir);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} aria-label="Previous" className="btn-ghost px-2 py-1 text-xs">←</button>
          <button onClick={() => setAnchor(startOfDay(new Date()))} className="btn-ghost px-2.5 py-1 text-xs">Today</button>
          <button onClick={() => shift(1)} aria-label="Next" className="btn-ghost px-2 py-1 text-xs">→</button>
          <span className="ml-1 text-sm font-medium text-fg">{rangeLabel(scope, anchor)}</span>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border bg-overlay/[0.03] p-0.5">
          {(["month", "week", "day"] as CalScope[]).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`rounded-lg px-2.5 py-1 text-xs capitalize transition-colors ${scope === s ? "bg-overlay/10 text-fg" : "text-muted hover:text-fg"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {scope !== "day" && (
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_LABEL.map((d) => (
            <div key={d} className="px-1 pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted">{d}</div>
          ))}
        </div>
      )}

      <div className={scope === "day" ? "space-y-1" : "grid grid-cols-7 gap-1"}>
        {days.map((day) => {
          const key = day.toDateString();
          const items = byDay.get(key) ?? [];
          const inMonth = scope !== "month" || day.getMonth() === anchor.getMonth();
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/task-id");
                const t = all.find((x) => x.id === id);
                if (t) onMove(t, day);
              }}
              className={`rounded-lg border p-1.5 transition-colors ${scope === "day" ? "min-h-[280px]" : "min-h-[86px]"} ${
                inMonth ? "border-border" : "border-transparent opacity-40"
              } ${isToday ? "border-accent/40 bg-accent/[0.06]" : "hover:border-overlay/15"}`}
            >
              <div className={`mb-1 text-[11px] ${isToday ? "font-semibold text-accent" : "text-muted"}`}>
                {scope === "day" ? `${WEEKDAY_FULL[day.getDay()]} ${day.getDate()}` : day.getDate()}
              </div>
              <div className="space-y-0.5">
                {items.slice(0, maxPerCell).map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/task-id", t.id); e.dataTransfer.effectAllowed = "move"; }}
                    onClick={() => cardProps.onToggle(t)}
                    title={t.title}
                    className={`cursor-grab truncate rounded px-1 py-0.5 text-[11px] hover:bg-overlay/[0.06] ${
                      t.status === "done"
                        ? "text-muted line-through"
                        : overdue(t)
                          ? "bg-action/10 text-action"
                          : PRIORITY_COLOR[t.priority ?? ""] ?? "text-fg"
                    }`}
                  >
                    {t.title}
                  </div>
                ))}
                {items.length > maxPerCell && (
                  <div className="text-[10px] text-muted">+{items.length - maxPerCell} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {dated.length === 0 && <Empty text="No tasks have due dates yet." />}
      {undated.length > 0 && (
        <Column title={`No due date (${undated.length})`}>
          {undated.map((t) => <TaskCard key={t.id} t={t} {...cardProps} />)}
        </Column>
      )}
    </div>
  );
}

function WorkloadView({
  open,
  done,
  nameById,
  capacityById,
  currentUserId,
  scope,
}: {
  open: TaskRow[];
  done: TaskRow[];
  nameById: Record<string, string>;
  capacityById: Record<string, number>;
  currentUserId: string;
  scope: WorkScope;
}) {
  const counts = new Map<string, { openCount: number; overdue: number; doneCount: number }>();
  for (const t of open) {
    const row = counts.get(t.assigneeId) ?? { openCount: 0, overdue: 0, doneCount: 0 };
    row.openCount += 1;
    if (overdue(t)) row.overdue += 1;
    counts.set(t.assigneeId, row);
  }
  for (const t of done) {
    const row = counts.get(t.assigneeId) ?? { openCount: 0, overdue: 0, doneCount: 0 };
    row.doneCount += 1;
    counts.set(t.assigneeId, row);
  }
  const medianCapacity = orgMedianCapacity(Object.values(capacityById));

  const rows = [...counts.entries()]
    .map(([userId, c]) => {
      const capacity = capacityById[userId];
      const score = composeScore([
        { key: "workload", label: "Workload balance", value: workloadIdealnessSignal(c.openCount, capacity, medianCapacity), weight: 0.4 },
        { key: "capacity", label: "Capacity headroom", value: capacityHeadroomSignal(c.openCount, capacity, medianCapacity), weight: 0.2 },
        { key: "reliability", label: "On-time rate", value: reliabilitySignal(c.openCount, c.overdue), weight: 0.2 },
        { key: "completion", label: "Task completion", value: taskCompletionSignal(c.doneCount, c.openCount), weight: 0.2 },
      ]);
      return {
        userId,
        name: userId === currentUserId ? `${nameById[userId] ?? "You"} (you)` : nameById[userId] ?? "Unassigned",
        capacity,
        score: score.overall,
        scoreBreakdown: score.signals,
        ...c,
      };
    })
    .sort((a, b) => a.score - b.score);

  if (rows.length === 0) return <Empty text="No open work to distribute." />;

  return (
    <section className="glass p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-fg">Workload — {SCOPE_LABEL[scope]}</h2>
        <span className="text-xs text-muted">overall score — lowest first</span>
      </div>
      <div className="space-y-3">
        {rows.map((r) => {
          const over = r.capacity != null && r.openCount > r.capacity;
          return (
            <div key={r.userId} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-fg">{r.name}</span>
                <span
                  title={r.scoreBreakdown.map((s) => `${s.label}: ${s.value}`).join(" · ")}
                  className={r.score >= 70 ? "text-teal" : r.score >= 40 ? "text-muted" : "text-action"}
                >
                  {r.score} / 100{over ? " · overloaded" : ""}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-overlay/[0.06]">
                <div
                  className={`h-full rounded-full ${over ? "bg-action" : "bg-teal"}`}
                  style={{ width: `${r.score}%` }}
                />
              </div>
              <div className="text-[11px] text-muted">
                {r.openCount} open{r.capacity != null ? ` of ${r.capacity} capacity` : ""}
                {r.overdue > 0 ? ` · ${r.overdue} overdue` : ""}
              </div>
            </div>
          );
        })}
      </div>
      {Object.keys(capacityById).length === 0 && (
        <p className="mt-3 text-xs text-muted">
          Tip: set each employee&apos;s capacity in People to see over/under-load precisely.
        </p>
      )}
    </section>
  );
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass p-4">
      <h2 className="mb-2 text-sm font-medium text-fg">{title}</h2>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-2 py-4 text-sm text-muted">{text}</p>;
}

function TaskCard({
  t,
  onToggle,
  showAssignee,
  nameById,
}: {
  t: TaskRow;
} & CardProps) {
  const isOverdue = overdue(t);
  return (
    <div className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-overlay/[0.03]">
      <button
        onClick={() => onToggle(t)}
        className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${
          t.status === "done" ? "border-teal bg-teal/20 text-teal" : "border-border text-transparent hover:border-accent"
        }`}
        title={t.status === "done" ? "Mark open" : "Mark done"}
      >
        ✓
      </button>
      <div className="min-w-0 flex-1">
        <div className={`text-sm ${t.status === "done" ? "text-muted line-through" : "text-fg"}`}>
          {t.leadId ? (
            <Link href={`/work/${t.leadId}`} className="hover:text-accent">{t.title}</Link>
          ) : (
            t.title
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          {t.priority && <span className={PRIORITY_COLOR[t.priority]}>{t.priority}</span>}
          {t.dueAt && (
            <span className={isOverdue ? "text-action" : ""}>
              {isOverdue ? "overdue · " : "due "}
              {fmtDate(t.dueAt)}
            </span>
          )}
          {showAssignee && <span>· {nameById[t.assigneeId] ?? "unassigned"}</span>}
        </div>
      </div>
    </div>
  );
}
