"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ds";

interface Item {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  group: string;
  run: () => void | Promise<void>;
}
interface SearchHit {
  type: "lead" | "company" | "employee" | "document";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

const TYPE_ICON: Record<string, string> = { lead: "🎯", company: "🏢", employee: "👤", document: "📄" };
const TYPE_GROUP: Record<string, string> = { company: "Companies", employee: "People", lead: "Deals", document: "Documents" };

/**
 * Global ⌘K / Ctrl+K command palette (Linear/Raycast-style). Jump to any page, search
 * leads/companies/employees/documents, run AI, and switch Demo⇄Production — the fastest way
 * to operate STOS as an OS rather than a set of pages.
 */
export function CommandPalette({ isOwner }: { isOwner: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const go = useCallback((href: string) => { setOpen(false); router.push(href); }, [router]);

  const switchMode = useCallback(async (mode: "demo" | "production") => {
    setOpen(false);
    const res = await fetch("/api/admin/mode", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }) });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      alert(b?.error ?? "Could not switch workspace mode.");
      return;
    }
    startTransition(() => router.refresh());
  }, [router]);

  // Static commands (navigation + actions).
  const commands = useMemo<Item[]>(() => {
    const nav = (id: string, title: string, href: string, icon = "↗"): Item => ({ id, title, icon, group: "Go to", subtitle: href, run: () => go(href) });
    const list: Item[] = [
      nav("home", "Home", "/home", "🏠"),
      ...(isOwner ? [nav("command", "Command Center", "/command", "🎯")] : []),
      nav("assistant", "Assistant", "/assistant", "🤖"),
      nav("work", "Work — Leads", "/work", "💼"),
      nav("tasks", "Work — Tasks", "/work/tasks", "✅"),
      nav("conveyor", "Work — Conveyor", "/work/conveyor", "🏭"),
      nav("people", "People", "/people", "👥"),
      nav("knowledge", "Knowledge", "/knowledge", "📚"),
      nav("workspace", "Organization", "/workspace", "🏗️"),
      nav("sales-models", "Sales models", "/admin/sales-models", "🎚️"),
      nav("settings", "Settings", "/admin/settings", "⚡"),
      { id: "new-task", title: "New task", icon: "➕", group: "Actions", subtitle: "Create a task", run: () => go("/work/tasks") },
      { id: "new-deal", title: "Create deal", icon: "💼", group: "Actions", subtitle: "Add a new lead/deal", run: () => go("/assistant?q=Create+a+new+deal") },
      { id: "new-meeting", title: "Schedule meeting", icon: "📅", group: "Actions", subtitle: "Book a meeting", run: () => go("/assistant?q=Schedule+a+meeting") },
      { id: "upload", title: "Upload document", icon: "📎", group: "Actions", subtitle: "Add to Knowledge", run: () => go("/knowledge") },
      { id: "gen-proposal", title: "Generate proposal", icon: "📝", group: "Actions", subtitle: "AI-drafted proposal", run: () => go("/assistant?q=Generate+a+proposal") },
      { id: "ask", title: "Ask STOS…", icon: "✦", group: "Actions", subtitle: "Open the AI assistant", run: () => go("/assistant") },
    ];
    if (isOwner) {
      list.push(
        nav("employees", "Employees", "/admin/employees", "👥"),
        nav("roles", "Roles & Permissions", "/admin/roles", "🔐"),
        nav("org", "Organization", "/admin/organization", "🏗️"),
        nav("audit", "Audit Log", "/admin/audit", "📋"),
        nav("ai-usage", "AI Usage", "/admin/ai-usage", "🧠"),
        { id: "demo", title: "Switch to Demo workspace", icon: "🧪", group: "Actions", run: () => switchMode("demo") },
        { id: "prod", title: "Switch to Production workspace", icon: "🚀", group: "Actions", run: () => switchMode("production") },
      );
    }
    return list;
  }, [isOwner, go, switchMode]);

  // Toggle on ⌘K / Ctrl+K.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) { setQ(""); setHits([]); setActive(0); setTimeout(() => inputRef.current?.focus(), 20); }
  }, [open]);

  // Debounced entity search.
  useEffect(() => {
    if (!open || q.trim().length < 1) { setHits([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const b = await res.json();
        setHits(res.ok ? (b.data ?? []) : []);
      } catch { setHits([]); }
    }, 160);
    return () => clearTimeout(t);
  }, [q, open]);

  const filteredCommands = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands;
    return commands.filter((c) => c.title.toLowerCase().includes(s) || c.group.toLowerCase().includes(s));
  }, [q, commands]);

  // Flatten into an ordered list for keyboard nav.
  const rows: Item[] = useMemo(() => [
    ...filteredCommands,
    ...hits.map((h) => ({ id: `${h.type}:${h.id}`, title: h.title, subtitle: h.subtitle, icon: TYPE_ICON[h.type] ?? "•", group: TYPE_GROUP[h.type] ?? "Results", run: () => go(h.href) })),
  ], [filteredCommands, hits, go]);

  useEffect(() => { setActive((a) => Math.min(a, Math.max(0, rows.length - 1))); }, [rows.length]);

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, rows.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); rows[active]?.run(); }
  }

  if (!open) return null;

  // Group rows for display while preserving global index for highlight.
  let idx = -1;
  const groups = ["Go to", "Actions", "Companies", "People", "Deals", "Documents", "Results"];

  return (
    <Modal onClose={() => setOpen(false)} maxWidth="max-w-xl">
      <div className="flex items-center gap-2 border-b border-overlay/5 px-4">
        <span className="text-muted">⌘</span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onInputKey}
          placeholder="Search or jump to…  (leads, people, docs, pages)"
          className="w-full bg-transparent py-3.5 text-sm text-fg outline-none placeholder:text-muted"
        />
        <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">esc</kbd>
      </div>

      <div className="max-h-[52vh] overflow-y-auto py-2">
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">No matches.</p>
        ) : (
          groups.map((g) => {
            const groupRows = rows.filter((r) => r.group === g);
            if (groupRows.length === 0) return null;
            return (
              <div key={g} className="mb-1">
                <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">{g}</div>
                {groupRows.map((r) => {
                  idx += 1;
                  const on = idx === active;
                  const myIdx = idx;
                  return (
                    <button
                      key={r.id}
                      onMouseEnter={() => setActive(myIdx)}
                      onClick={() => r.run()}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${on ? "bg-overlay/[0.07] text-fg" : "text-fg/85 hover:bg-overlay/[0.03]"}`}
                    >
                      <span className="w-5 text-center text-base leading-none">{r.icon}</span>
                      <span className="min-w-0 flex-1 truncate">{r.title}</span>
                      {r.subtitle && <span className="shrink-0 truncate text-xs text-muted">{r.subtitle}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-overlay/5 px-4 py-2 flex items-center gap-4 text-[10px] text-muted">
        <span>↑↓ navigate</span>
        <span>↵ select</span>
        <span>esc close</span>
      </div>
    </Modal>
  );
}
