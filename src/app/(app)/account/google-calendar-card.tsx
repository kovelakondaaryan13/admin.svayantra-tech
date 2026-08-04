"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface TestResult {
  healthy: boolean;
  detail: string;
}

export function GoogleCalendarCard({
  connected,
  accountEmail,
  canConnect,
  canTest,
}: {
  connected: boolean;
  accountEmail: string | null;
  canConnect: boolean;
  canTest: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);

  async function disconnect() {
    setBusy(true);
    try {
      const res = await fetch("/api/connectors/google/disconnect", { method: "POST" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        alert(b?.error ?? "Could not disconnect Google Calendar.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function runTest() {
    setBusy(true);
    try {
      const res = await fetch("/api/connectors/google_calendar/test", { method: "POST" });
      const b = await res.json().catch(() => ({}));
      setTest(b?.data ? { healthy: !!b.data.healthy, detail: b.data.detail ?? "Unknown" } : null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm text-fg">
          <span aria-hidden>📅</span> Google Calendar
        </div>
        <div className="mt-0.5 text-xs text-muted">
          {connected
            ? accountEmail ?? "Connected"
            : "Not connected — your meetings won't sync to your calendar"}
        </div>
        {test && (
          <p className={`mt-1 text-xs ${test.healthy ? "text-teal" : "text-red-400"}`}>
            {test.healthy ? "✓ " : "✕ "}{test.detail}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {connected ? (
          <>
            {canTest && (
              <button onClick={runTest} disabled={busy} className="btn-ghost text-xs">
                {busy ? "Testing…" : "Test"}
              </button>
            )}
            {canConnect && (
              <button onClick={disconnect} disabled={busy} className="btn-ghost text-xs">
                Disconnect
              </button>
            )}
          </>
        ) : canConnect ? (
          <a href="/api/connectors/google/oauth/start" className="btn-accent text-xs">Connect</a>
        ) : (
          <span className="text-xs text-muted">Ask your admin for calendar access</span>
        )}
      </div>
    </div>
  );
}
