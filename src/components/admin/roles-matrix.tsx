"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ds";

interface RoleView {
  key: string;
  label: string;
  permissions: string[];
}

export function RolesMatrix({
  domains,
  system,
  custom,
}: {
  domains: Record<string, string[]>;
  system: RoleView[];
  custom: (RoleView & { id: string })[];
}) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(p: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function create() {
    if (!key.trim() || !label.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, label, permissions: [...selected] }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "failed");
      setKey("");
      setLabel("");
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Roles & permissions"
        subtitle="System roles ship with least-privilege defaults. Create custom roles for your org."
      />

      <section className="grid gap-3 sm:grid-cols-2">
        {[...system, ...custom].map((r) => (
          <div key={r.key} className="glass p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-fg">{r.label}</span>
              <span className="text-xs text-muted">{r.permissions[0] === "*" ? "all" : `${r.permissions.length} perms`}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {r.permissions[0] === "*" ? (
                <span className="rounded bg-accent/20 px-1.5 py-0.5 text-xs text-accent">All permissions</span>
              ) : (
                r.permissions.slice(0, 8).map((p) => (
                  <span key={p} className="rounded bg-overlay/5 px-1.5 py-0.5 text-[11px] text-muted">
                    {p}
                  </span>
                ))
              )}
              {r.permissions.length > 8 && r.permissions[0] !== "*" && (
                <span className="text-[11px] text-muted">+{r.permissions.length - 8}</span>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="glass p-5">
        <h2 className="mb-3 text-sm font-semibold tracking-tight">Create custom role</h2>
        <div className="mb-3 flex gap-2">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
            placeholder="role_key"
            className="w-40 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Display label"
            className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(domains).map(([domain, perms]) => (
            <div key={domain} className="rounded-lg border border-border bg-surface p-3">
              <div className="mb-1.5 text-xs font-medium text-fg">{domain}</div>
              <div className="space-y-1">
                {perms.map((p) => (
                  <label key={p} className="flex cursor-pointer items-center gap-2 text-xs text-muted">
                    <input type="checkbox" checked={selected.has(p)} onChange={() => toggle(p)} />
                    {p}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        <button
          onClick={create}
          disabled={busy}
          className="mt-3 btn-accent"
        >
          {busy ? "Creating…" : `Create role (${selected.size} perms)`}
        </button>
      </section>
    </div>
  );
}
