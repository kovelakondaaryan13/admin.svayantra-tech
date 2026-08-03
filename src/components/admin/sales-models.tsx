"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ds";

type Model = "individual" | "conveyor";

interface PlaybookRow {
  id: string;
  key: string;
  label: string;
  model: Model;
  description?: string;
  stageCount: number;
  stageLabels: string[];
  kpis?: string[];
  enabled: boolean;
}
interface TeamRow {
  id: string;
  name: string;
  memberUserIds: string[];
  playbookKey?: string;
}
interface EmployeeRef {
  userId: string;
  name: string;
}

const slug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export function SalesModelsAdmin({
  canPlaybooks,
  canTeams,
  playbooks,
  teams,
  employees,
}: {
  canPlaybooks: boolean;
  canTeams: boolean;
  playbooks: PlaybookRow[];
  teams: TeamRow[];
  employees: EmployeeRef[];
}) {
  const nameById = Object.fromEntries(employees.map((e) => [e.userId, e.name]));
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Sales models"
        subtitle="Configure the operating playbooks and conveyor teams that drive your revenue engine — the same primitives STOS and the AI execute against."
      />

      {canPlaybooks && <PlaybooksSection playbooks={playbooks} />}
      {canTeams && (
        <ConveyorTeamsSection teams={teams} employees={employees} nameById={nameById} playbooks={playbooks} />
      )}
    </div>
  );
}

function PlaybooksSection({ playbooks }: { playbooks: PlaybookRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [model, setModel] = useState<Model>("conveyor");
  const [description, setDescription] = useState("");
  const [stagesText, setStagesText] = useState("");
  const [sla, setSla] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    const stageLines = stagesText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!label.trim() || stageLines.length === 0) {
      setError("A label and at least one stage are required.");
      return;
    }
    const slaHours = sla.trim() ? Number(sla) : undefined;
    const stages = stageLines.map((l) => ({
      key: slug(l),
      label: l,
      ...(slaHours && !Number.isNaN(slaHours) ? { slaHours } : {}),
    }));
    setBusy(true);
    try {
      const res = await fetch("/api/playbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: slug(label), label: label.trim(), model, description: description.trim() || undefined, stages, enabled: true }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b?.error ?? "Could not create playbook.");
        return;
      }
      setLabel(""); setDescription(""); setStagesText(""); setSla(""); setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/playbooks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        alert(b?.error ?? "Could not delete that playbook.");
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">Operating playbooks</h2>
        <button onClick={() => setOpen((o) => !o)} className="btn-ghost text-xs">
          {open ? "Cancel" : "+ New playbook"}
        </button>
      </div>

      {open && (
        <div className="glass space-y-3 p-4">
          {error && <p className="text-xs text-action">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Enterprise Outbound" className="inp" />
            </Field>
            <Field label="Execution model">
              <select value={model} onChange={(e) => setModel(e.target.value as Model)} className="inp">
                <option value="conveyor">Conveyor Belt</option>
                <option value="individual">Individual Funnel</option>
              </select>
            </Field>
          </div>
          <Field label="Description (optional)">
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="When to use this playbook" className="inp" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-[1fr,120px]">
            <Field label="Stages (one per line, in order)">
              <textarea
                value={stagesText}
                onChange={(e) => setStagesText(e.target.value)}
                rows={5}
                placeholder={"Lead Sourcing\nQualification\nOutreach\nProposal\nClosing"}
                className="inp font-mono text-xs"
              />
            </Field>
            <Field label="SLA hrs / stage">
              <input value={sla} onChange={(e) => setSla(e.target.value)} inputMode="numeric" placeholder="48" className="inp" />
            </Field>
          </div>
          <div className="flex justify-end">
            <button onClick={create} disabled={busy} className="btn-accent text-sm">
              {busy ? "Creating…" : "Create playbook"}
            </button>
          </div>
        </div>
      )}

      {playbooks.length === 0 ? (
        <Empty text="No playbooks yet. Create one, or run `npm run seed-sales` for the starter set." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {playbooks.map((p) => (
            <div key={p.id} className="glass flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-fg">{p.label}</div>
                  <div className="text-xs text-muted">
                    {p.model === "conveyor" ? "Conveyor Belt" : "Individual Funnel"} · {p.stageCount} stages
                  </div>
                </div>
                <button onClick={() => remove(p.id)} disabled={busy} className="text-xs text-muted hover:text-action">
                  delete
                </button>
              </div>
              {p.description && <p className="text-xs text-muted">{p.description}</p>}
              <div className="flex flex-wrap gap-1">
                {p.stageLabels.map((s, i) => (
                  <span key={i} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-fg/70">
                    {s}
                  </span>
                ))}
              </div>
              {p.kpis && p.kpis.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted">KPIs</span>
                  {p.kpis.map((k) => (
                    <span key={k} className="rounded-full bg-teal/10 px-2 py-0.5 text-[11px] text-teal">{k}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ConveyorTeamsSection({
  teams,
  employees,
  nameById,
  playbooks,
}: {
  teams: TeamRow[];
  employees: EmployeeRef[];
  nameById: Record<string, string>;
  playbooks: PlaybookRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [playbookKey, setPlaybookKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conveyorPlaybooks = playbooks.filter((p) => p.model === "conveyor");

  function toggleMember(id: string) {
    setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }

  async function create() {
    setError(null);
    if (!name.trim() || members.length === 0) {
      setError("A team name and at least one member are required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/conveyor-teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), memberUserIds: members, playbookKey: playbookKey || undefined }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b?.error ?? "Could not create team.");
        return;
      }
      setName(""); setMembers([]); setPlaybookKey(""); setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/conveyor-teams/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        alert(b?.error ?? "Could not delete that team.");
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">Conveyor teams</h2>
        <button onClick={() => setOpen((o) => !o)} className="btn-ghost text-xs">
          {open ? "Cancel" : "+ New team"}
        </button>
      </div>

      {open && (
        <div className="glass space-y-3 p-4">
          {error && <p className="text-xs text-action">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Team name">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Outbound Team Alpha" className="inp" />
            </Field>
            <Field label="Playbook (optional)">
              <select value={playbookKey} onChange={(e) => setPlaybookKey(e.target.value)} className="inp">
                <option value="">— none —</option>
                {conveyorPlaybooks.map((p) => (
                  <option key={p.id} value={p.key}>{p.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Members">
            <div className="flex flex-wrap gap-1.5">
              {employees.length === 0 && <span className="text-xs text-muted">No active employees.</span>}
              {employees.map((e) => {
                const on = members.includes(e.userId);
                return (
                  <button
                    key={e.userId}
                    onClick={() => toggleMember(e.userId)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      on ? "border-accent bg-accent/15 text-fg" : "border-border text-muted hover:text-fg"
                    }`}
                  >
                    {e.name}
                  </button>
                );
              })}
            </div>
          </Field>
          <div className="flex justify-end">
            <button onClick={create} disabled={busy} className="btn-accent text-sm">
              {busy ? "Creating…" : "Create team"}
            </button>
          </div>
        </div>
      )}

      {teams.length === 0 ? (
        <Empty text="No conveyor teams yet. A team shares access to all conveyor leads assigned to it." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((t) => (
            <div key={t.id} className="glass flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-fg">{t.name}</div>
                  <div className="text-xs text-muted">
                    {t.memberUserIds.length} member{t.memberUserIds.length === 1 ? "" : "s"}
                    {t.playbookKey ? ` · ${t.playbookKey}` : ""}
                  </div>
                </div>
                <button onClick={() => remove(t.id)} disabled={busy} className="text-xs text-muted hover:text-action">
                  delete
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {t.memberUserIds.map((id) => (
                  <span key={id} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-fg/70">
                    {nameById[id] ?? id}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </label>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="glass px-4 py-6 text-center text-sm text-muted">{text}</p>;
}
