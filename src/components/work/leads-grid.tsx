"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImportLeadsModal } from "@/components/work/import-leads-modal";

export interface Lead {
  id: string;
  name: string;
  company?: string;
  email?: string;
  stage: string;
  source?: string;
  value?: { amountMinor: number; currency: string };
}

const STAGES = ["new", "qualified", "meeting", "proposal", "negotiation", "won", "lost"];
const SOURCES = ["apollo", "linkedin", "website", "referral", "email", "whatsapp", "conference", "manual", "other"];
const stageColor: Record<string, string> = {
  new: "text-muted",
  qualified: "text-accent",
  meeting: "text-accent",
  proposal: "text-yellow-400",
  negotiation: "text-action",
  won: "text-teal",
  lost: "text-red-400",
};

export function LeadsGrid({
  leads: initial,
  canWrite = false,
  canDelete = false,
  canAdvance = false,
}: {
  leads: Lead[];
  canWrite?: boolean;
  canDelete?: boolean;
  canAdvance?: boolean;
}) {
  const router = useRouter();
  const [leads, setLeads] = useState(initial);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const filtered = leads.filter(
    (l) =>
      (l.name + " " + (l.company ?? "") + " " + (l.email ?? "")).toLowerCase().includes(query.toLowerCase()) &&
      (!sourceFilter || l.source === sourceFilter),
  );

  async function patch(id: string, body: Record<string, unknown>) {
    const prior = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, ...body } : l)));
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) setLeads(prior);
  }

  async function advance(id: string, to: string) {
    const res = await fetch(`/api/leads/${id}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to }),
    });
    if (res.ok) setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, stage: to } : l)));
    else router.refresh();
  }

  async function addRow() {
    setBusy(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New lead" }),
      });
      const b = await res.json();
      if (res.ok) setLeads((ls) => [{ id: b.data.id, name: b.data.name, stage: b.data.stage }, ...ls]);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (res.ok) setLeads((ls) => ls.filter((l) => l.id !== id));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search leads…"
          className="w-64 rounded-xl border border-border bg-overlay/[0.03] px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-xl border border-border bg-overlay/[0.03] px-3 py-1.5 text-sm capitalize outline-none focus:border-accent"
        >
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-xs text-muted">{filtered.length} of {leads.length}</span>
        {canWrite && (
          <>
            <button onClick={() => setImportOpen(true)} className="btn-ghost ml-auto px-3 py-1.5 text-xs">
              Import CSV/Excel
            </button>
            <button onClick={addRow} disabled={busy} className="btn-action px-3 py-1.5 text-xs">
              + New lead
            </button>
          </>
        )}
      </div>

      {importOpen && (
        <ImportLeadsModal
          onClose={() => setImportOpen(false)}
          onImported={(newLeads) => setLeads((ls) => [...newLeads, ...ls])}
        />
      )}

      <div className="glass overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-overlay/5 text-left text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Company</th>
              <th className="px-4 py-2.5 font-medium">Value (₹)</th>
              <th className="px-4 py-2.5 font-medium">Source</th>
              <th className="px-4 py-2.5 font-medium">Stage</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="group border-t border-overlay/5 hover:bg-overlay/[0.02]">
                <td className="px-2 py-1">
                  <Cell value={l.name} editable={canWrite} onSave={(v) => patch(l.id, { name: v })} />
                </td>
                <td className="px-2 py-1">
                  <Cell value={l.company ?? ""} placeholder="—" editable={canWrite} onSave={(v) => patch(l.id, { company: v })} />
                </td>
                <td className="px-2 py-1">
                  <Cell
                    value={l.value ? String(l.value.amountMinor / 100) : ""}
                    placeholder="—"
                    numeric
                    editable={canWrite}
                    onSave={(v) => patch(l.id, { value: v ? { amountMinor: Number(v) * 100, currency: "INR" } : undefined })}
                  />
                </td>
                <td className="px-4 py-1">
                  <select
                    value={l.source ?? ""}
                    disabled={!canWrite}
                    onChange={(e) => patch(l.id, { source: e.target.value || undefined })}
                    className="rounded-md border border-transparent bg-transparent px-1 py-1 text-xs capitalize text-muted outline-none hover:border-border disabled:opacity-60"
                  >
                    <option value="" className="bg-panel text-fg">—</option>
                    {SOURCES.map((s) => (
                      <option key={s} value={s} className="bg-panel text-fg">{s}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-1">
                  <select
                    value={l.stage}
                    disabled={!canAdvance}
                    onChange={(e) => advance(l.id, e.target.value)}
                    className={`rounded-md border border-transparent bg-transparent px-1 py-1 text-xs outline-none hover:border-border disabled:opacity-60 ${stageColor[l.stage] ?? ""}`}
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s} className="bg-panel text-fg">
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="whitespace-nowrap px-2">
                  <Link
                    href={`/work/${l.id}`}
                    className="mr-1 text-xs text-muted opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
                    title="Open lead"
                  >
                    ↗
                  </Link>
                  {canDelete && (
                    <button
                      onClick={() => remove(l.id)}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      title="Delete"
                    >
                      <span className="text-xs text-muted hover:text-red-400">✕</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
                  No leads. Click “New lead”, or ask STOS to import them.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cell({
  value,
  placeholder,
  numeric,
  editable = true,
  onSave,
}: {
  value: string;
  placeholder?: string;
  numeric?: boolean;
  editable?: boolean;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value);
  if (editing) {
    return (
      <input
        autoFocus
        value={v}
        type={numeric ? "number" : "text"}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (v !== value) onSave(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setV(value);
            setEditing(false);
          }
        }}
        className="w-full rounded-md border border-accent/40 bg-overlay/[0.04] px-2 py-1.5 text-sm outline-none"
      />
    );
  }
  function startEditing() {
    setV(value);
    setEditing(true);
  }
  if (!editable) {
    return (
      <div className="rounded-md px-2 py-1.5">
        {value || <span className="text-muted">{placeholder}</span>}
      </div>
    );
  }
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={startEditing}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          startEditing();
        }
      }}
      className="cursor-text rounded-md px-2 py-1.5 outline-none hover:bg-overlay/[0.04] focus-visible:ring-1 focus-visible:ring-accent/50"
    >
      {value || <span className="text-muted">{placeholder}</span>}
    </div>
  );
}
