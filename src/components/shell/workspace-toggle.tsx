"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Mode = "demo" | "production";

/**
 * Owner control to switch the whole app between the Demo and Production workspaces.
 * Flips the org mode, then refreshes every server component (router.refresh) so all
 * widgets, CRM, work, calendar, knowledge, and dashboards re-read the active workspace.
 */
export function WorkspaceToggle({ initialMode }: { initialMode: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = saving || pending;

  async function switchTo(next: Mode) {
    if (next === mode || busy) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      if (res.ok) {
        setMode(next);
        startTransition(() => router.refresh());
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <div className="relative inline-flex items-center rounded-full border border-border bg-overlay/[0.03] p-0.5 text-xs">
        {(["demo", "production"] as Mode[]).map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              onClick={() => switchTo(m)}
              disabled={busy}
              className={`relative rounded-full px-3 py-1 font-medium transition-colors ${
                active
                  ? m === "demo"
                    ? "bg-accent/20 text-accent"
                    : "bg-teal/20 text-teal"
                  : "text-muted hover:text-fg"
              }`}
            >
              {m === "demo" ? "Demo" : "Production"}
            </button>
          );
        })}
      </div>
      {busy && <span className="text-xs text-muted">refreshing…</span>}
    </div>
  );
}
