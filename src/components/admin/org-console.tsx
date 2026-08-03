"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";

export interface OrgNode {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  managerUserId?: string | null;
  managerName?: string;
  memberCount: number;
  headcountCapacity?: number;
  vacancies?: number | null;
}
interface EmployeeOpt {
  userId: string;
  name: string;
}

const TYPES = [
  "department", "team", "business_unit", "division", "branch",
  "region", "location", "cost_center", "subsidiary",
];
const ICON: Record<string, string> = {
  department: "🏢", team: "👥", business_unit: "💼", division: "🏬", branch: "🏦",
  region: "🌍", location: "📍", cost_center: "💰", subsidiary: "🏛️",
};
const pretty = (t: string) => t.replace(/_/g, " ");

export function OrgConsole({
  units,
  employees,
  canEdit,
}: {
  units: OrgNode[];
  employees: EmployeeOpt[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | "root" | null>(null);
  const [busy, setBusy] = useState(false);

  // add form
  const [name, setName] = useState("");
  const [type, setType] = useState("department");
  const [parentId, setParentId] = useState("");
  const [capacity, setCapacity] = useState("");

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, OrgNode[]>();
    for (const u of units) {
      const pid = u.parentId ?? null;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(u);
    }
    return map;
  }, [units]);

  async function api(path: string, method: string, body?: unknown) {
    setBusy(true);
    try {
      const res = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j?.error ?? "Action failed");
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  const patch = (id: string, body: Record<string, unknown>) =>
    api(`/api/admin/org-units/${id}`, "PATCH", body);

  async function add() {
    if (!name.trim() || busy) return;
    const ok = await api("/api/admin/org-units", "POST", {
      name: name.trim(),
      type,
      parentId: parentId || undefined,
      headcountCapacity: capacity ? Number(capacity) : undefined,
    });
    if (ok) {
      setName("");
      setCapacity("");
    }
  }

  async function remove(id: string, hasChildren: boolean) {
    if (hasChildren) {
      alert("Move or remove its sub-units first.");
      return;
    }
    if (!confirm("Delete this unit?")) return;
    await api(`/api/admin/org-units/${id}`, "DELETE");
  }

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function commitRename(id: string) {
    const v = draftName.trim();
    setEditingId(null);
    if (v) await patch(id, { name: v });
  }

  async function onDrop(targetId: string | null) {
    const id = dragId;
    setDragId(null);
    setDropTarget(null);
    if (!id || id === targetId) return;
    await patch(id, { parentId: targetId });
  }

  function Node({ node, depth }: { node: OrgNode; depth: number }) {
    const kids = childrenOf.get(node.id) ?? [];
    const isCollapsed = collapsed.has(node.id);
    const cap = node.headcountCapacity;
    return (
      <div>
        <div
          draggable={canEdit}
          onDragStart={() => canEdit && setDragId(node.id)}
          onDragOver={(e) => {
            if (canEdit && dragId && dragId !== node.id) {
              e.preventDefault();
              setDropTarget(node.id);
            }
          }}
          onDragLeave={() => setDropTarget((t) => (t === node.id ? null : t))}
          onDrop={(e) => {
            e.preventDefault();
            onDrop(node.id);
          }}
          style={{ marginLeft: depth * 22 }}
          className={`glass flex items-center gap-2 px-3 py-2 transition-colors ${
            dropTarget === node.id ? "ring-1 ring-accent" : ""
          } ${dragId === node.id ? "opacity-50" : ""}`}
        >
          {/* collapse chevron */}
          {kids.length > 0 ? (
            <button
              onClick={() => toggle(node.id)}
              className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted hover:text-fg"
              aria-label={isCollapsed ? "Expand" : "Collapse"}
            >
              <span className={`transition-transform ${isCollapsed ? "" : "rotate-90"}`}>▸</span>
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}

          <span className="shrink-0 text-base" title={pretty(node.type)}>
            {ICON[node.type] ?? "•"}
          </span>

          {/* name (inline rename) */}
          <div className="min-w-0 flex-1">
            {editingId === node.id ? (
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={() => commitRename(node.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(node.id);
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="w-full rounded border border-border bg-surface px-2 py-0.5 text-sm outline-none focus:border-accent"
              />
            ) : (
              <span
                className="truncate text-sm text-fg"
                onDoubleClick={() => {
                  if (canEdit) {
                    setEditingId(node.id);
                    setDraftName(node.name);
                  }
                }}
                title={canEdit ? "Double-click to rename" : undefined}
              >
                {node.name}
              </span>
            )}
            <span className="ml-2 text-xs text-muted">· {pretty(node.type)}</span>
          </div>

          {/* headcount chip */}
          <span
            className="hidden shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted sm:inline"
            title="Members / capacity"
          >
            {node.memberCount}
            {typeof cap === "number" ? `/${cap}` : ""} people
            {typeof node.vacancies === "number" && node.vacancies > 0 ? (
              <span className="ml-1 text-action">· {node.vacancies} open</span>
            ) : null}
          </span>

          {/* manager */}
          {canEdit ? (
            <select
              value={node.managerUserId ?? ""}
              disabled={busy}
              onChange={(e) => patch(node.id, { managerUserId: e.target.value || null })}
              className="hidden max-w-[9rem] shrink-0 rounded border border-border bg-surface px-2 py-1 text-xs text-muted outline-none focus:border-accent md:block"
              title="Manager"
            >
              <option value="">— manager —</option>
              {employees.map((e) => (
                <option key={e.userId} value={e.userId}>
                  {e.name}
                </option>
              ))}
            </select>
          ) : node.managerName ? (
            <span className="hidden shrink-0 text-xs text-muted md:inline">{node.managerName}</span>
          ) : null}

          {/* capacity + actions */}
          {canEdit && (
            <div className="flex shrink-0 items-center gap-1">
              <input
                type="number"
                min={0}
                defaultValue={cap ?? ""}
                disabled={busy}
                onBlur={(e) => {
                  const v = e.target.value;
                  const n = v === "" ? undefined : Number(v);
                  if (n !== cap) patch(node.id, { headcountCapacity: n ?? 0 });
                }}
                placeholder="cap"
                className="hidden w-14 rounded border border-border bg-surface px-1.5 py-1 text-xs outline-none focus:border-accent lg:block"
                title="Headcount capacity"
              />
              <button
                onClick={() => {
                  setParentId(node.id);
                  document.getElementById("org-add")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="rounded px-1.5 py-1 text-xs text-muted hover:text-accent"
                title="Add sub-unit"
              >
                + sub
              </button>
              <button
                onClick={() => remove(node.id, kids.length > 0)}
                className="rounded px-1.5 py-1 text-xs text-muted hover:text-red-400"
                title="Delete"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {!isCollapsed && kids.length > 0 && (
          <div className="mt-1.5 space-y-1.5">
            {kids.map((k) => (
              <Node key={k.id} node={k} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const roots = childrenOf.get(null) ?? [];

  return (
    <div className="space-y-4">
      {units.length === 0 ? (
        <EmptyState title="No org units yet" hint="Add your first department, division, or region below." />
      ) : (
        <>
          {canEdit && (
            <div
              onDragOver={(e) => {
                if (dragId) {
                  e.preventDefault();
                  setDropTarget("root");
                }
              }}
              onDragLeave={() => setDropTarget((t) => (t === "root" ? null : t))}
              onDrop={(e) => {
                e.preventDefault();
                onDrop(null);
              }}
              className={`rounded-xl border border-dashed px-3 py-2 text-center text-xs transition-colors ${
                dropTarget === "root" ? "border-accent text-accent" : "border-border text-muted"
              }`}
            >
              Drop here to make a unit top-level
            </div>
          )}
          <div className="space-y-1.5">
            {roots.map((r) => (
              <Node key={r.id} node={r} depth={0} />
            ))}
          </div>
        </>
      )}

      {canEdit && (
        <section id="org-add" className="glass p-4">
          <h2 className="mb-3 text-sm font-semibold tracking-tight">Add unit</h2>
          <div className="flex flex-wrap gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Unit name"
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm capitalize outline-none focus:border-accent"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {pretty(t)}
                </option>
              ))}
            </select>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">— top level —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="capacity"
              className="w-24 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button onClick={add} disabled={busy} className="btn-accent">
              Add
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
