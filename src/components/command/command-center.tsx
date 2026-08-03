"use client";
import { useState } from "react";
import { fmtLakhCr as lakh, fmtRelativeTime } from "@/lib/format";
import { MiniKpi as Kpi, type MiniKpiTone as Tone } from "@/components/ds/kpi";
import type { CommandCenter } from "@/services/command-center-service";

const relTime = (iso: string) => fmtRelativeTime(iso, { suffix: " ago", zeroLabel: "just now" });

export function CommandCenterView({ cc }: { cc: CommandCenter }) {
  const [recs, setRecs] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch("/api/command-center/recommendations", { method: "POST" });
      const b = await res.json();
      setRecs(res.ok ? b.data.recommendations : b?.error ?? "Could not generate recommendations.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* KPI row — forecast */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Booked (won)" value={lakh(cc.forecast.bookedMinor)} tone="good" />
        <Kpi label="Weighted forecast" value={lakh(cc.forecast.weightedPipelineMinor)} />
        <Kpi label="Total pipeline" value={lakh(cc.forecast.totalPipelineMinor)} />
        <Kpi label="Win rate" value={cc.forecast.winRate == null ? "—" : `${cc.forecast.winRate}%`} />
      </div>

      {/* AI recommendations */}
      <section className="ai-surface p-5">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="ai-chip">✦</span>
            <h2 className="text-sm font-semibold text-fg">AI recommendations</h2>
          </div>
          <button onClick={generate} disabled={busy} className="btn-action px-3 py-1.5 text-xs">
            {busy ? "Thinking…" : recs ? "Refresh" : "Generate"}
          </button>
        </div>
        {recs ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg/90">{recs}</p>
        ) : (
          <p className="text-sm text-muted">
            Ask STOS what to do about today&apos;s picture — it reads everything below and prioritizes.
          </p>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="What happened" badge={`${cc.yesterday.total} in 48h`}>
          {cc.yesterday.items.length === 0 ? (
            <Empty text="Quiet — no recent activity." />
          ) : (
            cc.yesterday.items.map((a, i) => (
              <Row key={i} left={a.summary} right={relTime(a.at)} tone={a.kind === "won" ? "good" : a.kind === "lost" ? "bad" : "neutral"} />
            ))
          )}
        </Panel>

        <Panel title="What's blocked" badge={cc.blocked.approvalsWaiting + cc.blocked.slaBreaches > 0 ? "action needed" : "clear"} badgeTone={cc.blocked.items.length ? "bad" : "good"}>
          {cc.blocked.items.length === 0 ? (
            <Empty text="Nothing blocked. 🎉" />
          ) : (
            cc.blocked.items.map((s, i) => <Row key={i} left={s} tone="bad" />)
          )}
        </Panel>

        <Panel title="Who needs help" badge={`${cc.needHelp.length}`} badgeTone={cc.needHelp.length ? "bad" : "good"}>
          {cc.needHelp.length === 0 ? (
            <Empty text="Everyone within capacity." />
          ) : (
            cc.needHelp.map((h) => (
              <Row key={h.userId} left={h.name} right={`${h.openCount}${h.capacity ? `/${h.capacity}` : ""} open · ${h.overdue} overdue`} tone="bad" />
            ))
          )}
        </Panel>

        <Panel title="Deals at risk" badge={`${cc.atRisk.length}`} badgeTone={cc.atRisk.length ? "bad" : "good"}>
          {cc.atRisk.length === 0 ? (
            <Empty text="No deals flagged at risk." />
          ) : (
            cc.atRisk.map((r, i) => <Row key={i} left={r.name} right={r.reason} tone="bad" />)
          )}
        </Panel>

        <Panel title="Team utilization" badge={`${cc.utilization.length}`}>
          {cc.utilization.length === 0 ? (
            <Empty text="No open work assigned." />
          ) : (
            cc.utilization.map((u) => {
              const pct = u.capacity && u.capacity > 0 ? Math.min(100, Math.round((u.openCount / u.capacity) * 100)) : null;
              return (
                <div key={u.userId} className="space-y-1 py-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-fg">{u.name}</span>
                    <span className={u.overloaded ? "text-action" : "text-muted"}>
                      {u.openCount}{u.capacity ? `/${u.capacity}` : ""}{u.overloaded ? " · overloaded" : ""}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-overlay/[0.06]">
                    <div className={`h-full rounded-full ${u.overloaded ? "bg-action" : "bg-teal"}`} style={{ width: `${pct ?? Math.min(100, u.openCount * 12)}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </Panel>

        <Panel title="Bottlenecks" badge={`${cc.bottlenecks.length}`}>
          {cc.bottlenecks.length === 0 ? (
            <Empty text="No bottlenecks detected." />
          ) : (
            cc.bottlenecks.map((b, i) => <Row key={i} left={b} tone="neutral" />)
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, badge, badgeTone = "neutral", children }: { title: string; badge?: string; badgeTone?: Tone; children: React.ReactNode }) {
  const bc = badgeTone === "good" ? "text-teal" : badgeTone === "bad" ? "text-action" : "text-muted";
  return (
    <section className="glass p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-fg">{title}</h2>
        {badge && <span className={`text-xs ${bc}`}>{badge}</span>}
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Row({ left, right, tone = "neutral" }: { left: string; right?: string; tone?: Tone }) {
  const dot = tone === "good" ? "bg-teal" : tone === "bad" ? "bg-action" : "bg-overlay/20";
  return (
    <div className="flex items-start justify-between gap-3 py-0.5 text-sm">
      <span className="flex min-w-0 items-start gap-2 text-fg/90">
        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
        <span className="min-w-0">{left}</span>
      </span>
      {right && <span className="shrink-0 text-xs text-muted">{right}</span>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-1 py-2 text-sm text-muted">{text}</p>;
}
