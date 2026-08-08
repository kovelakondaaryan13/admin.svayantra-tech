"use client";
import { useState } from "react";

export function UploadRetentionSettings({ initialDays, canManage }: { initialDays: number; canManage: boolean }) {
  const [days, setDays] = useState(initialDays);
  const [saved, setSaved] = useState(initialDays);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/uploads/retention", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { setError(b?.error ?? "Could not save retention."); return; }
      setSaved(days);
      setMessage("Saved.");
    } finally {
      setBusy(false);
    }
  }

  async function sweepNow() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/uploads/sweep", { method: "POST" });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { setError(b?.error ?? "Could not run cleanup."); return; }
      setMessage(`Removed ${b.data.swept} failed upload${b.data.swept === 1 ? "" : "s"} older than ${b.data.retentionDays} days.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold text-fg">Upload cleanup</h2>
        <p className="text-xs text-muted">Failed document uploads older than this many days are eligible for removal.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-fg">
          Keep failed uploads for
          <input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
            disabled={!canManage || busy}
            className="inp w-20"
          />
          days
        </label>
        {canManage && (
          <button onClick={save} disabled={busy || days === saved} className="btn-ghost text-xs">
            {busy ? "Saving…" : "Save"}
          </button>
        )}
        {canManage && (
          <button onClick={sweepNow} disabled={busy} className="btn-ghost text-xs">
            {busy ? "Working…" : "Run cleanup now"}
          </button>
        )}
      </div>

      {message && <p className="text-xs text-teal">{message}</p>}
      {error && <p className="text-xs text-action">{error}</p>}
      {!canManage && <p className="text-xs text-muted">Only org admins can change retention or trigger cleanup.</p>}
    </section>
  );
}
