/**
 * STOS Design System v2 — the ONE way AI appears: branded, alive, special.
 * Variants: briefing (narrative), insight (inline), chip (tag). Token-only, presentational;
 * consumers own the thinking/stream state. See STOS_DESIGN_SYSTEM.md §2.4, §7.
 */
import type { ReactNode } from "react";

export function AIChip({ children = "✦", pulse = false }: { children?: ReactNode; pulse?: boolean }) {
  return <span className={`ai-chip ${pulse ? "animate-pulse-glow" : ""}`}>{children}</span>;
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="STOS is thinking">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" />
    </span>
  );
}

export function AICallout({
  title = "STOS",
  action,
  thinking = false,
  confidence,
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  thinking?: boolean;
  confidence?: "high" | "medium" | "low";
  children?: ReactNode;
}) {
  return (
    <section className="ai-surface overflow-hidden">
      <div className="flex items-center justify-between border-b border-overlay/5 px-5 py-3">
        <div className="flex items-center gap-2">
          <AIChip pulse={thinking} />
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          <span className="badge badge-brand ml-1">AI</span>
          {confidence && (
            <span className="t-micro ml-1">
              confidence:{" "}
              <span className={confidence === "high" ? "text-teal" : confidence === "low" ? "text-action" : "text-muted"}>
                {confidence}
              </span>
            </span>
          )}
        </div>
        {action}
      </div>
      <div className="px-5 py-4" aria-live="polite">
        {thinking && !children ? <TypingDots /> : children}
      </div>
    </section>
  );
}

/** Inline AI tip — smaller, for embedding in object pages/lists. */
export function AIInsight({ children }: { children: ReactNode }) {
  return (
    <div className="ai-surface flex items-start gap-3 px-4 py-3">
      <AIChip />
      <div className="min-w-0 flex-1 text-sm text-fg/90">{children}</div>
    </div>
  );
}
