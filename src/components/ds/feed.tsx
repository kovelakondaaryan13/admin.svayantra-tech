/**
 * STOS Design System v2 — Timeline + ActivityFeed. One timeline style, one feed style, used on
 * every object and in org-wide history. Token-only, presentational.
 * See STOS_DESIGN_SYSTEM.md §2.5–2.6, §7 (living feel).
 */
import type { ReactNode } from "react";
import { Avatar } from "@/components/ds/primitives";

type Tone = "won" | "lost" | "note" | "neutral";
const DOT: Record<Tone, string> = {
  won: "bg-teal",
  lost: "bg-action",
  note: "bg-accent/70",
  neutral: "bg-overlay/25",
};

export interface TimelineItem {
  id: string;
  title: ReactNode;
  meta?: string;
  time?: string; // display string
  tone?: Tone;
}

export function Timeline({ items, compact = false }: { items: TimelineItem[]; compact?: boolean }) {
  if (items.length === 0) return <p className="px-1 py-2 text-sm text-muted">Nothing yet.</p>;
  return (
    <ol className="relative ml-1 space-y-0">
      <span className="absolute bottom-2 left-[3px] top-2 w-px bg-border" aria-hidden />
      {items.map((it) => (
        <li key={it.id} className={`relative flex gap-3 ${compact ? "py-1" : "py-2"}`}>
          <span className={`relative z-10 mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[it.tone ?? "neutral"]}`} />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-fg/90">{it.title}</div>
            {it.meta && <div className="t-micro">{it.meta}</div>}
          </div>
          {it.time && <time className="t-micro shrink-0">{it.time}</time>}
        </li>
      ))}
    </ol>
  );
}

export interface ActivityItem {
  id: string;
  actor: string;
  summary: ReactNode;
  time?: string;
  tone?: Tone;
}

export function ActivityFeed({ items, dense = false }: { items: ActivityItem[]; dense?: boolean }) {
  if (items.length === 0) return <p className="px-1 py-2 text-sm text-muted">No recent activity.</p>;
  return (
    <ul className="divide-y divide-border/60">
      {items.map((it) => (
        <li key={it.id} className={`animate-in flex items-start gap-3 ${dense ? "py-1.5" : "py-2.5"}`}>
          <Avatar name={it.actor} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="text-sm text-fg/90">{it.summary}</div>
            <div className="t-micro">{it.actor}{it.time ? ` · ${it.time}` : ""}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
