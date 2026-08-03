"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WorkScope } from "@/services/task-service";
import { fmtDate } from "@/lib/format";

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
        <CalendarView open={open} {...cardProps} />
      ) : (
        <WorkloadView
          open={open}
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

function CalendarView({ open, ...cardProps }: { open: TaskRow[] } & CardProps) {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today.getTime() + 86400000);
  const weekEnd = new Date(today.getTime() + 7 * 86400000);

  const buckets: { label: string; test: (d: Date) => boolean }[] = [
    { label: "Overdue", test: (d) => d < today },
    { label: "Today", test: (d) => d >= today && d < tomorrow },
    { label: "Tomorrow", test: (d) => d >= tomorrow && d < new Date(tomorrow.getTime() + 86400000) },
    { label: "This week", test: (d) => d >= new Date(tomorrow.getTime() + 86400000) && d < weekEnd },
    { label: "Later", test: (d) => d >= weekEnd },
  ];

  const dated = open.filter((t) => t.dueAt);
  const undated = open.filter((t) => !t.dueAt);

  return (
    <div className="space-y-4">
      {buckets.map((b) => {
        const items = dated.filter((t) => b.test(startOfDay(new Date(t.dueAt!))));
        if (items.length === 0) return null;
        return (
          <Column key={b.label} title={`${b.label} (${items.length})`}>
            {items
              .sort((a, z) => new Date(a.dueAt!).getTime() - new Date(z.dueAt!).getTime())
              .map((t) => <TaskCard key={t.id} t={t} {...cardProps} />)}
          </Column>
        );
      })}
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
  nameById,
  capacityById,
  currentUserId,
  scope,
}: {
  open: TaskRow[];
  nameById: Record<string, string>;
  capacityById: Record<string, number>;
  currentUserId: string;
  scope: WorkScope;
}) {
  const counts = new Map<string, { openCount: number; overdue: number }>();
  for (const t of open) {
    const row = counts.get(t.assigneeId) ?? { openCount: 0, overdue: 0 };
    row.openCount += 1;
    if (overdue(t)) row.overdue += 1;
    counts.set(t.assigneeId, row);
  }
  const rows = [...counts.entries()]
    .map(([userId, c]) => ({
      userId,
      name: userId === currentUserId ? `${nameById[userId] ?? "You"} (you)` : nameById[userId] ?? "Unassigned",
      capacity: capacityById[userId],
      ...c,
    }))
    .sort((a, b) => b.openCount - a.openCount);

  if (rows.length === 0) return <Empty text="No open work to distribute." />;

  return (
    <section className="glass p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-fg">Workload — {SCOPE_LABEL[scope]}</h2>
        <span className="text-xs text-muted">open items vs. capacity</span>
      </div>
      <div className="space-y-3">
        {rows.map((r) => {
          const cap = r.capacity;
          const pct = cap && cap > 0 ? Math.min(100, Math.round((r.openCount / cap) * 100)) : null;
          const over = cap != null && r.openCount > cap;
          return (
            <div key={r.userId} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-fg">{r.name}</span>
                <span className={over ? "text-action" : "text-muted"}>
                  {r.openCount}
                  {cap != null ? ` / ${cap}` : ""} open
                  {r.overdue > 0 ? ` · ${r.overdue} overdue` : ""}
                  {over ? " · overloaded" : ""}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-overlay/[0.06]">
                <div
                  className={`h-full rounded-full ${over ? "bg-action" : "bg-teal"}`}
                  style={{ width: `${pct ?? Math.min(100, r.openCount * 12)}%` }}
                />
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
