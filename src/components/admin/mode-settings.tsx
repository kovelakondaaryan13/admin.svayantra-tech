"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "demo" | "production";

export function ModeSettings({ initialMode, canToggle }: { initialMode: Mode; canToggle: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function switchTo(next: Mode) {
    if (next === mode || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { setError(b?.error ?? "Could not change mode."); return; }
      setMode(next);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-fg">Operating mode</h2>
          <p className="text-xs text-muted">Controls whether synthetic data and simulations are allowed.</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            mode === "demo" ? "bg-accent/15 text-accent" : "bg-teal/15 text-teal"
          }`}
        >
          {mode === "demo" ? "Demo" : "Production"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card
          active={mode === "demo"}
          title="Demo mode"
          points={["Synthetic simulation data allowed", "`npm run simulate` + Reset enabled", "Safe for evaluation"]}
          onSelect={canToggle ? () => switchTo("demo") : undefined}
          busy={busy}
        />
        <Card
          active={mode === "production"}
          title="Production mode"
          points={["Real users and real data only", "Synthetic/destructive seeding refused", "For live operations"]}
          onSelect={canToggle ? () => switchTo("production") : undefined}
          busy={busy}
        />
      </div>

      {error && <p className="text-xs text-action">{error}</p>}
      {!canToggle && (
        <p className="text-xs text-muted">Only the owner can change the operating mode.</p>
      )}
      {mode === "production" && (
        <p className="text-xs text-muted">
          Simulation and demo-reset operations are disabled. Switch to Demo mode to run them.
        </p>
      )}
    </section>
  );
}

function Card({
  active,
  title,
  points,
  onSelect,
  busy,
}: {
  active: boolean;
  title: string;
  points: string[];
  onSelect?: () => void;
  busy: boolean;
}) {
  return (
    <button
      type="button"
      disabled={!onSelect || busy || active}
      onClick={onSelect}
      className={`rounded-xl border p-4 text-left transition-colors ${
        active ? "border-accent bg-accent/10" : "border-border hover:border-overlay/20"
      } ${!onSelect ? "cursor-default" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-fg">{title}</span>
        {active && <span className="text-xs text-accent">current</span>}
      </div>
      <ul className="mt-2 space-y-1">
        {points.map((p) => (
          <li key={p} className="text-xs text-muted">• {p}</li>
        ))}
      </ul>
      {!active && onSelect && <span className="mt-3 inline-block text-xs text-accent">Switch →</span>}
    </button>
  );
}
