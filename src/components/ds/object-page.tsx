"use client";
/**
 * STOS Design System v2 — the canonical object-detail template. EVERY first-class object
 * (Company, Person, Deal, Department) uses this exact shell.
 *
 * Product philosophy (STOS_DESIGN_SYSTEM.md §0): every object answers exactly two questions —
 *   • "What is happening?"  → the CONTEXT tab (always the default, always first).
 *   • "What can I do?"      → the ACTION BAR (one primary, a few secondary, the rest in ⋯ More).
 * Nothing else competes with those two. If a user has to ask "where do I do X?", the design failed:
 * every common action is either in the Action Bar or discoverable via ⌘K — never buried in a tab.
 *
 * Actions carry no callbacks (server pages stay server components): each item is plain data and is
 * dispatched here — `tab` switches the active tab, `href` navigates, `intent` opens the Assistant
 * pre-scoped to this object (the orchestrator already has the tools to execute the verb).
 */
import { useRef, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Avatar, Badge, type BadgeVariant } from "@/components/ds/primitives";
import { AIChip } from "@/components/ds/ai-callout";
import { intentService } from "@/services/intent-service";

export interface ObjectTab {
  key: string;
  label: string;
  content: ReactNode;
}

export interface ObjectStatus {
  label: string;
  variant?: BadgeVariant;
}

export interface ObjectActionItem {
  label: string;
  icon?: ReactNode;
  tier?: "primary" | "secondary" | "more"; // default "secondary"
  tab?: string; // switch to this tab
  href?: string; // navigate
  intent?: string; // open Assistant pre-filled with this instruction
  intentKey?: string; // machine key for the intent (title + analytics), e.g. "create_task"
  danger?: boolean; // styles a destructive "more" item
}

export interface ObjectRef {
  type: string; // "company" | "lead" | "person"
  id: string;
}

export function ObjectPage({
  name,
  kind,
  avatarSrc,
  logo,
  statuses = [],
  aiSummary,
  actions,
  actionBar = [],
  askAi,
  objectRef,
  tabs,
}: {
  name: string;
  kind?: string; // "Company" | "Person" | "Deal" | …
  avatarSrc?: string;
  logo?: ReactNode; // overrides avatar (e.g., an emoji/icon tile)
  statuses?: ObjectStatus[];
  aiSummary?: ReactNode;
  actions?: ReactNode; // top-right (e.g. a back-link) — never the primary action
  actionBar?: ObjectActionItem[]; // the "what can I do?" layer
  askAi?: string; // Assistant instruction for the always-present ✦ Ask AI button
  objectRef?: ObjectRef; // links intents to this object (scopes the Assistant conversation)
  tabs: ObjectTab[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(tabs[0]?.key);
  const [moreOpen, setMoreOpen] = useState(false);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Build the object-scoped Assistant deep-link for an intent (falls back to a bare query).
  function intentHref(instruction: string, intentKey?: string): string {
    if (objectRef) {
      return intentService.launch({
        objectType: objectRef.type,
        objectId: objectRef.id,
        objectName: name,
        instruction,
        intent: intentKey,
        origin: `${(kind ?? "object").toLowerCase()}_action_bar`,
        returnUrl: pathname ?? undefined,
      });
    }
    return `/assistant?q=${encodeURIComponent(instruction)}`;
  }

  function onKey(e: React.KeyboardEvent, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = e.key === "ArrowRight" ? (i + 1) % tabs.length : (i - 1 + tabs.length) % tabs.length;
    const k = tabs[next].key;
    setActive(k);
    tabRefs.current[k]?.focus();
  }

  function dispatch(item: ObjectActionItem) {
    setMoreOpen(false);
    if (item.tab) setActive(item.tab);
    else if (item.href) router.push(item.href);
    else if (item.intent) router.push(intentHref(item.intent, item.intentKey));
  }

  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  const primary = actionBar.filter((a) => a.tier === "primary");
  const secondary = actionBar.filter((a) => (a.tier ?? "secondary") === "secondary");
  const more = actionBar.filter((a) => a.tier === "more");
  const hasBar = actionBar.length > 0 || !!askAi;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Object header */}
      <header className="glass p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {logo ? (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-2xl">{logo}</span>
            ) : (
              <Avatar name={name} src={avatarSrc} size="lg" />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {kind && <span className="t-micro uppercase tracking-wide">{kind}</span>}
                {statuses.map((s) => (
                  <Badge key={s.label} variant={s.variant ?? "neutral"}>{s.label}</Badge>
                ))}
              </div>
              <h1 className="mt-0.5 truncate text-xl font-semibold tracking-tight">{name}</h1>
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>

        {aiSummary && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-violet/15 bg-ai px-3.5 py-2.5">
            <AIChip />
            <p className="min-w-0 flex-1 text-sm leading-relaxed text-fg/90">{aiSummary}</p>
          </div>
        )}

        {/* Action Bar — "what can I do?" */}
        {hasBar && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {primary.map((a) => (
              <button key={a.label} onClick={() => dispatch(a)} className="btn-accent text-sm">
                {a.icon} {a.label}
              </button>
            ))}
            {secondary.map((a) => (
              <button key={a.label} onClick={() => dispatch(a)} className="btn-ghost text-sm">
                {a.icon} {a.label}
              </button>
            ))}

            {more.length > 0 && (
              <div className="relative">
                <button onClick={() => setMoreOpen((v) => !v)} aria-haspopup="menu" aria-expanded={moreOpen} className="btn-ghost text-sm" title="More actions">⋯</button>
                {moreOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} aria-hidden />
                    <div role="menu" className="glass absolute right-0 z-20 mt-1 w-48 p-1 shadow-e2">
                      {more.map((a) => (
                        <button
                          key={a.label}
                          role="menuitem"
                          onClick={() => dispatch(a)}
                          className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-overlay/[0.05] ${a.danger ? "text-action" : "text-fg"}`}
                        >
                          {a.icon} {a.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {askAi && (
              <button
                onClick={() => router.push(intentHref(askAi, "ask"))}
                className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-violet/25 bg-ai px-3 py-1.5 text-sm text-fg transition-colors hover:border-violet/40"
                title={`Ask STOS about this ${(kind ?? "object").toLowerCase()}`}
              >
                <AIChip /> Ask AI
              </button>
            )}
          </div>
        )}
      </header>

      {/* Tabs */}
      <div role="tablist" aria-label={`${name} sections`} className="flex flex-wrap items-center gap-1 border-b border-overlay/5">
        {tabs.map((t, i) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              ref={(el) => { tabRefs.current[t.key] = el; }}
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onKeyDown={(e) => onKey(e, i)}
              onClick={() => setActive(t.key)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors duration-200 ease-emphasized ${
                on ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div role="tabpanel" className="animate-in space-y-4">
        {current?.content}
      </div>
    </div>
  );
}
