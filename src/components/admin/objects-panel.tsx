"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ds";

interface FieldDef {
  key: string;
  label: string;
  type: string;
}
interface Def {
  id: string;
  key: string;
  label: string;
  labelPlural: string;
  displayField: string;
  fields: FieldDef[];
}

export function ObjectsPanel({ defs, canManage }: { defs: Def[]; canManage: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Def | null>(defs[0] ?? null);
  const [records, setRecords] = useState<{ id: string; name: string }[]>([]);
  const [recData, setRecData] = useState<Record<string, string>>({});
  const [defForm, setDefForm] = useState({ key: "", label: "", labelPlural: "", fieldsText: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selected) return;
    fetch(`/api/objects/${selected.key}`)
      .then((r) => r.json())
      .then((b) => setRecords((b.data ?? []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name }))))
      .catch(() => setRecords([]));
  }, [selected]);

  async function createDef() {
    const fields = defForm.fieldsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [key, label, type] = l.split("|").map((s) => s.trim());
        return { key, label: label || key, type: type || "text" };
      });
    if (!defForm.key || !defForm.label || fields.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/object-definitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: defForm.key,
          label: defForm.label,
          labelPlural: defForm.labelPlural || defForm.label + "s",
          displayField: fields[0].key,
          fields,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        alert(b?.error ?? "Could not create that object definition.");
        return;
      }
      setDefForm({ key: "", label: "", labelPlural: "", fieldsText: "" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function createRecord() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/objects/${selected.key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: recData }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        alert(b?.error ?? "Could not create that record.");
        return;
      }
      setRecData({});
      const b = await (await fetch(`/api/objects/${selected.key}`)).json();
      setRecords((b.data ?? []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name })));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Data models"
        subtitle="Model anything — factories, machines, patients, projects — with CRUD, permissions, audit, and AI search, no code."
      />

      <div className="flex flex-wrap gap-2">
        {defs.map((d) => (
          <button
            key={d.id}
            onClick={() => setSelected(d)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              selected?.id === d.id ? "border-accent text-fg" : "border-border text-muted hover:text-fg"
            }`}
          >
            {d.labelPlural}
          </button>
        ))}
        {defs.length === 0 && <span className="text-sm text-muted">No objects defined yet.</span>}
      </div>

      {selected && (
        <section className="grid gap-6 md:grid-cols-2">
          <div className="glass p-4">
            <h2 className="mb-3 text-sm font-semibold">New {selected.label}</h2>
            <div className="space-y-2">
              {selected.fields.map((f) => (
                <input
                  key={f.key}
                  value={recData[f.key] ?? ""}
                  onChange={(e) => setRecData((d) => ({ ...d, [f.key]: e.target.value }))}
                  placeholder={f.label}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                />
              ))}
              <button
                onClick={createRecord}
                disabled={busy}
                className="btn-accent w-full"
              >
                Add {selected.label}
              </button>
            </div>
          </div>
          <div className="glass p-4">
            <h2 className="mb-3 text-sm font-semibold">
              {selected.labelPlural} ({records.length})
            </h2>
            <ul className="space-y-1.5">
              {records.map((r) => (
                <li key={r.id} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg">
                  {r.name}
                </li>
              ))}
              {records.length === 0 && <li className="text-sm text-muted">None yet.</li>}
            </ul>
          </div>
        </section>
      )}

      {canManage && (
        <section className="glass p-5">
          <h2 className="mb-3 text-sm font-semibold tracking-tight">Define new object</h2>
          <div className="mb-2 flex flex-wrap gap-2">
            <input
              value={defForm.key}
              onChange={(e) => setDefForm((f) => ({ ...f, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") }))}
              placeholder="object_key"
              className="w-40 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <input
              value={defForm.label}
              onChange={(e) => setDefForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Label (e.g. Factory)"
              className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <input
              value={defForm.labelPlural}
              onChange={(e) => setDefForm((f) => ({ ...f, labelPlural: e.target.value }))}
              placeholder="Plural (Factories)"
              className="w-40 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <textarea
            value={defForm.fieldsText}
            onChange={(e) => setDefForm((f) => ({ ...f, fieldsText: e.target.value }))}
            placeholder={"Fields, one per line as key|Label|type\nname|Name|text\ncapacity|Capacity|number"}
            rows={4}
            className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent"
          />
          <button
            onClick={createDef}
            disabled={busy}
            className="btn-accent mt-2"
          >
            Create object
          </button>
        </section>
      )}
    </div>
  );
}
