"use client";
import { useCallback, useEffect, useState } from "react";

interface HealthCheck {
  status: "healthy" | "degraded" | "down";
  latencyMs?: number;
}

interface HealthData {
  status: "healthy" | "degraded" | "down";
  checks: Record<string, HealthCheck>;
  timestamp: string;
}

const STATUS_DOT: Record<string, string> = {
  healthy: "bg-teal",
  degraded: "bg-warning",
  down: "bg-action",
};

const STATUS_LABEL: Record<string, string> = {
  healthy: "All Systems Healthy",
  degraded: "Some Systems Degraded",
  down: "Systems Unavailable",
};

const CHECK_LABELS: Record<string, string> = {
  database: "Database",
  ai: "AI Engine",
  knowledge: "Knowledge Base",
  notifications: "Notifications",
};

export function SystemStatus() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [open, setOpen] = useState(false);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const b = await res.json();
        setHealth(b.data);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") check();
    }, 60000);
    return () => clearInterval(interval);
  }, [check]);

  const status = health?.status ?? "healthy";

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(o => !o); check(); }}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted transition-colors hover:text-fg"
        title={STATUS_LABEL[status]}
      >
        <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
        <span className="hidden lg:inline">{status === "healthy" ? "Healthy" : status === "degraded" ? "Degraded" : "Down"}</span>
      </button>

      {open && health && (
        <div className="floating animate-in absolute bottom-full left-0 z-50 mb-2 w-56 overflow-hidden">
          <div className="border-b border-overlay/5 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT[health.status]}`} />
              <span className="text-xs font-semibold text-fg">{STATUS_LABEL[health.status]}</span>
            </div>
          </div>
          <div className="space-y-0.5 p-2">
            {Object.entries(health.checks).map(([key, check]) => (
              <div key={key} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs">
                <span className="text-fg">{CHECK_LABELS[key] ?? key}</span>
                <div className="flex items-center gap-1.5">
                  {check.latencyMs != null && (
                    <span className="text-muted">{check.latencyMs}ms</span>
                  )}
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[check.status]}`} />
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-overlay/5 px-4 py-2 text-[10px] text-muted">
            Last check: {new Date(health.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}
