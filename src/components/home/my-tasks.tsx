"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface MyTaskRow {
  id: string;
  title: string;
  priority?: "low" | "medium" | "high";
  dueLabel?: string; // formatted server-side — "Overdue", "Today, 3:00 PM", etc.
  bucket: "overdue" | "today" | "highPriority" | "upcoming";
  assignedByName?: string; // omitted when self-assigned or unresolvable
  leadId?: string;
}

const BUCKET_LABEL: Record<MyTaskRow["bucket"], string> = {
  overdue: "Overdue",
  today: "Due today",
  highPriority: "High priority",
  upcoming: "Upcoming",
};
const BUCKET_ORDER: MyTaskRow["bucket"][] = ["overdue", "today", "highPriority", "upcoming"];

/**
 * "What should I do today?" — grouped, actionable personal task list for Home. Buckets
 * and due-date labels are computed server-side (see home/page.tsx) to avoid SSR/CSR
 * date-formatting drift; this component only owns the one-click-complete interaction.
 */
export function MyTasks({ tasks }: { tasks: MyTaskRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(tasks);
  const [completing, setCompleting] = useState<Set<string>>(new Set());

  async function complete(id: string) {
    setCompleting((s) => new Set(s).add(id));
    setRows((r) => r.filter((t) => t.id !== id));
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    if (!res.ok) {
      // Restore just this task, not the whole stale initial snapshot — other tasks
      // completed earlier in this session may already be durable on the server.
      const restored = tasks.find((t) => t.id === id);
      if (restored) setRows((r) => (r.some((t) => t.id === id) ? r : [...r, restored]));
    } else {
      router.refresh();
    }
    setCompleting((s) => { const next = new Set(s); next.delete(id); return next; });
  }

  if (rows.length === 0) {
    return (
      <section className="glass p-4">
        <h2 className="mb-1 text-sm font-medium text-fg">My tasks</h2>
        <p className="text-sm text-muted">You&apos;re all caught up — nothing pressing.</p>
      </section>
    );
  }

  const byBucket = BUCKET_ORDER.map((b) => ({ bucket: b, items: rows.filter((t) => t.bucket === b) })).filter((g) => g.items.length > 0);

  return (
    <section className="glass p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-fg">My tasks</h2>
        <Link href="/work/tasks" className="text-xs text-muted transition-colors hover:text-accent">open →</Link>
      </div>
      <div className="space-y-3">
        {byBucket.map((g) => (
          <div key={g.bucket}>
            <div className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${g.bucket === "overdue" ? "text-action" : "text-muted"}`}>
              {BUCKET_LABEL[g.bucket]} ({g.items.length})
            </div>
            <div className="space-y-1">
              {g.items.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-overlay/[0.03]">
                  <button
                    onClick={() => complete(t.id)}
                    disabled={completing.has(t.id)}
                    className="grid h-4 w-4 shrink-0 place-items-center rounded border border-border text-transparent transition-colors hover:border-teal hover:text-teal"
                    title="Mark done"
                  >
                    ✓
                  </button>
                  <Link href={t.leadId ? `/work/${t.leadId}` : "/work/tasks"} className="min-w-0 flex-1 truncate text-sm text-fg hover:text-accent">
                    {t.title}
                  </Link>
                  <span className="shrink-0 text-xs text-muted">
                    {t.assignedByName ? `from ${t.assignedByName}` : ""}
                    {t.assignedByName && t.dueLabel ? " · " : ""}
                    {t.dueLabel ?? ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
