"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export interface IssueRow {
  id: string;
  title: string;
  status: "open" | "investigating" | "resolved" | "closed";
  aiResponse?: string;
  aiResolved: boolean;
  createdAt: string;
}

const STATUS_TONE: Record<IssueRow["status"], string> = {
  open: "text-action",
  investigating: "text-accent",
  resolved: "text-teal",
  closed: "text-muted",
};

export function RaiseIssue({ initial }: { initial: IssueRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<IssueRow | null>(null);
  const [issues, setIssues] = useState(initial);

  async function submit() {
    if (!title.trim() || !description.trim()) {
      setError("A title and description are required.");
      return;
    }
    setBusy(true);
    setError(null);
    setLastResult(null);
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { setError(b?.error ?? "Could not submit the issue."); return; }
      const created: IssueRow = b.data;
      setLastResult(created);
      setIssues((prev) => [created, ...prev]);
      setTitle(""); setDescription(""); setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {!open ? (
        <button onClick={() => setOpen(true)} className="btn-ghost text-xs">Raise Issue</button>
      ) : (
        <div className="space-y-2 rounded-xl border border-border p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's the issue? (short title)"
            className="inp"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what happened, what you expected, and any steps to reproduce."
            rows={4}
            className="inp resize-none"
          />
          {error && <p className="text-xs text-action">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="btn-ghost text-xs">Cancel</button>
            <button onClick={submit} disabled={busy} className="btn-accent text-xs">
              {busy ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>
      )}

      {lastResult && (
        <div className={`rounded-xl border p-3 text-sm ${lastResult.aiResolved ? "border-teal/30 bg-teal/5" : "border-accent/30 bg-accent/5"}`}>
          {lastResult.aiResolved ? (
            <>
              <p className="mb-1 font-medium text-fg">Resolved by STOS</p>
              <p className="text-fg/90">{lastResult.aiResponse}</p>
            </>
          ) : (
            <>
              <p className="mb-1 font-medium text-fg">Routed to the team</p>
              <p className="text-fg/90">{lastResult.aiResponse ?? "Someone will follow up soon."}</p>
            </>
          )}
        </div>
      )}

      {issues.length > 0 && (
        <div className="space-y-1">
          {issues.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-overlay/[0.03]">
              <span className="min-w-0 flex-1 truncate text-fg">{i.title}</span>
              <span className={`shrink-0 text-xs font-medium capitalize ${STATUS_TONE[i.status]}`}>{i.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
