/**
 * STOS Design System v2 — charts. Decision-driven only: a chart earns its place by answering
 * "are we healthy / where's the problem?", never decoration (STOS_DESIGN_SYSTEM.md §0.0).
 *
 * BarChart is single-series by design — one measure across categories (pipeline value by stage,
 * workload by person). Single series ⇒ one hue, no legend (the title names it), so we sidestep
 * categorical-palette risk entirely. Colors come from tokens (rgb(var(--…))) so light/dark are the
 * same chart re-themed, not a flipped copy. Mark specs: 4px rounded data-ends anchored to the
 * baseline, a 2px gap between bars, recessive axis, direct value labels, per-bar hover. Pure
 * HTML/CSS — no dependency, renders server-side.
 */
import type { ReactNode } from "react";

export type ChartTone = "brand" | "good" | "warning" | "bad" | "muted";

const TONE_VAR: Record<ChartTone, string> = {
  brand: "var(--blue)",
  good: "var(--success)",
  warning: "var(--warning)",
  bad: "var(--danger)",
  muted: "var(--muted)",
};

export interface BarDatum {
  label: string;
  value: number;
  display?: string; // formatted value shown as the direct label (defaults to the number)
  tone?: ChartTone; // per-bar override (e.g. "bad" for an over-capacity person)
  href?: string; // reserved — not linked here to keep this render-only
}

function EmptyChart({ children }: { children: ReactNode }) {
  return <p className="px-1 py-8 text-center text-sm text-muted">{children}</p>;
}

/** Vertical bars for "value across ordered categories" (e.g. pipeline value by stage). */
export function BarChart({
  data,
  height = 168,
  tone = "brand",
  empty = "No data yet.",
}: {
  data: BarDatum[];
  height?: number;
  tone?: ChartTone;
  empty?: ReactNode;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (data.length === 0 || max <= 0) return <EmptyChart>{empty}</EmptyChart>;

  return (
    <div className="w-full">
      <div className="flex items-end gap-0.5" style={{ height }}>
        {data.map((d) => {
          const pct = Math.max(2, Math.round((d.value / max) * 100)); // ≥2% so non-zero always shows
          return (
            <div key={d.label} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${d.label}: ${d.display ?? d.value}`}>
              <span className="t-micro tabular-nums opacity-0 transition-opacity group-hover:opacity-100">{d.display ?? d.value}</span>
              <div
                className="w-full max-w-[3rem] rounded-t transition-[filter] duration-200 group-hover:brightness-110"
                style={{ height: `${pct}%`, backgroundColor: `rgb(${TONE_VAR[d.tone ?? tone]})` }}
              />
            </div>
          );
        })}
      </div>
      {/* Recessive baseline + category labels */}
      <div className="mt-1.5 border-t border-overlay/10" />
      <div className="mt-1.5 flex gap-0.5">
        {data.map((d) => (
          <span key={d.label} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted" title={d.label}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bars for "measure per named entity" (e.g. team workload by person). */
export function BarChartH({
  data,
  tone = "brand",
  empty = "No data yet.",
}: {
  data: BarDatum[];
  tone?: ChartTone;
  empty?: ReactNode;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (data.length === 0 || max <= 0) return <EmptyChart>{empty}</EmptyChart>;

  return (
    <div className="space-y-1.5">
      {data.map((d) => {
        const pct = Math.max(2, Math.round((d.value / max) * 100));
        return (
          <div key={d.label} className="group flex items-center gap-2 text-sm" title={`${d.label}: ${d.display ?? d.value}`}>
            <span className="w-28 shrink-0 truncate text-xs text-muted" title={d.label}>{d.label}</span>
            <div className="h-4 min-w-0 flex-1">
              <div
                className="h-full rounded-r transition-[filter] duration-200 group-hover:brightness-110"
                style={{ width: `${pct}%`, backgroundColor: `rgb(${TONE_VAR[d.tone ?? tone]})` }}
              />
            </div>
            <span className="w-14 shrink-0 text-right text-xs tabular-nums text-fg/90">{d.display ?? d.value}</span>
          </div>
        );
      })}
    </div>
  );
}
