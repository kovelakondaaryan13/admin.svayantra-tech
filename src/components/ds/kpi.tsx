/**
 * STOS Design System v2 — the standard KPI presentation: StatTile + KpiRow.
 * Executive metrics look the same everywhere. Token-only, presentational.
 * See STOS_DESIGN_SYSTEM.md §2.3, §6.
 */
import type { ReactNode } from "react";

type Tone = "neutral" | "good" | "bad" | "brand";

const TONE: Record<Tone, string> = {
  neutral: "text-fg",
  good: "text-teal",
  bad: "text-action",
  brand: "text-gradient",
};

export function StatTile({
  label,
  value,
  icon,
  tone = "neutral",
  delta,
  hero = false,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  /**
   * Movement vs a prior period, e.g. { dir: "up", text: "+8% this week" }. Direction is shown by an
   * arrow (never color alone). `tone` sets the semantics because up isn't always good (rising deal
   * age / open tasks is "bad"); defaults to up=good, down=bad.
   */
  delta?: { dir: "up" | "down"; text: string; tone?: "good" | "bad" | "neutral" };
  hero?: boolean;
}) {
  const deltaTone = delta ? (delta.tone ?? (delta.dir === "up" ? "good" : "bad")) : "neutral";
  const deltaClass = deltaTone === "good" ? "text-teal" : deltaTone === "bad" ? "text-action" : "text-muted";
  return (
    <div className="glass glass-hover p-4">
      <div className="flex items-center justify-between">
        <span className="t-micro uppercase tracking-wide">{label}</span>
        {icon && <span className="text-sm opacity-70">{icon}</span>}
      </div>
      <div className={`mt-2 font-semibold tracking-tight ${hero ? "text-3xl" : "text-2xl"} ${TONE[tone]}`}>
        {value}
      </div>
      {delta && (
        <div className={`mt-1 flex items-center gap-1 text-xs ${deltaClass}`}>
          <span aria-hidden>{delta.dir === "up" ? "▲" : "▼"}</span>
          <span>{delta.text}</span>
        </div>
      )}
    </div>
  );
}

export function KpiRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

/** Compact KPI tile — for dense operational dashboards (conveyor/command center), where
 *  StatTile's icon/delta/hero chrome is more than the panel needs. */
export type MiniKpiTone = "good" | "bad" | "neutral";

export function MiniKpi({ label, value, tone = "neutral" }: { label: string; value: string; tone?: MiniKpiTone }) {
  const color = tone === "good" ? "text-teal" : tone === "bad" ? "text-action" : "text-fg";
  return (
    <div className="rounded-xl border border-border bg-overlay/[0.02] p-3">
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
      <div className="mt-0.5 text-[11px] text-muted">{label}</div>
    </div>
  );
}
