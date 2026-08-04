"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ds";
import { fmtDate } from "@/lib/format";

interface ConnectorItem {
  kind: string;
  label: string;
  category: string;
  availability: "configured" | "available" | "planned";
  connected: boolean;
  status: string | null;
  accountEmail: string | null;
  lastSyncedAt: string | null;
}

type TestResult = { healthy: boolean; detail: string };

export function ConnectorsPanel({
  items,
  connected,
  error,
  canManageGoogle = false,
  canTestGoogle = false,
}: {
  items: ConnectorItem[];
  connected?: string;
  error?: string;
  canManageGoogle?: boolean;
  canTestGoogle?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestResult>>({});

  async function disconnectGoogle() {
    setBusy("google_calendar");
    try {
      const res = await fetch("/api/connectors/google/disconnect", { method: "POST" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        alert(b?.error ?? "Could not disconnect Google Calendar.");
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function test(kind: string) {
    setBusy(kind);
    try {
      const res = await fetch(`/api/connectors/${kind}/test`, { method: "POST" });
      const body = await res.json();
      const d = body?.data ?? {};
      setTests((t) => ({ ...t, [kind]: { healthy: !!d.healthy, detail: d.detail ?? "Unknown" } }));
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const categories = Array.from(new Set(items.map((i) => i.category)));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Integrations"
        subtitle="Connect the tools your company already uses. Every connector shares one interface — the AI reads from the internal knowledge layer, never a specific vendor."
      />

      {connected && (
        <div className="rounded-lg border border-teal/30 bg-teal/10 px-3 py-2 text-sm text-teal">
          Connected {connected.replace("_", " ")}.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {categories.map((cat) => (
        <section key={cat} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{cat}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {items
              .filter((c) => c.category === cat)
              .map((c) => {
                const t = tests[c.kind];
                return (
                  <div key={c.kind} className="glass glass-hover flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-fg">{c.label}</span>
                          <StatusDot connected={c.connected} status={c.status} />
                        </div>
                        <div className="mt-0.5 text-xs text-muted">
                          {c.connected && c.accountEmail ? c.accountEmail : capitalize(c.category)}
                          {c.connected && c.lastSyncedAt
                            ? ` · synced ${fmtDate(c.lastSyncedAt)}`
                            : ""}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {c.kind === "google_calendar" ? (
                        c.connected ? (
                          <>
                            {canTestGoogle && (
                              <button onClick={() => test(c.kind)} disabled={busy === c.kind} className="btn-ghost text-xs">
                                {busy === c.kind ? "Testing…" : "Test"}
                              </button>
                            )}
                            {canManageGoogle && (
                              <>
                                <a href="/api/connectors/google/oauth/start" className="btn-ghost text-xs">Reconnect</a>
                                <button onClick={disconnectGoogle} disabled={busy === c.kind} className="btn-ghost text-xs">
                                  Disconnect
                                </button>
                              </>
                            )}
                          </>
                        ) : c.availability !== "configured" ? (
                          <span className="text-xs text-muted">Set GOOGLE_CLIENT_ID to enable</span>
                        ) : canManageGoogle ? (
                          <a href="/api/connectors/google/oauth/start" className="btn-accent">Connect</a>
                        ) : (
                          <span className="text-xs text-muted">Ask your admin to grant calendar access to connect this.</span>
                        )
                      ) : (
                        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                          Coming soon
                        </span>
                      )}
                    </div>

                    {t && (
                      <p className={`text-xs ${t.healthy ? "text-teal" : "text-red-400"}`}>
                        {t.healthy ? "✓ Healthy — " : "✕ "}{t.detail}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}

function StatusDot({ connected, status }: { connected: boolean; status: string | null }) {
  const color = !connected ? "bg-overlay/20" : status === "error" ? "bg-red-400" : "bg-teal";
  const label = !connected ? "Not connected" : status === "error" ? "Error" : "Connected";
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
