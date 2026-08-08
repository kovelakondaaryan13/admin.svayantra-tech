"use client";
import { useState } from "react";
import Link from "next/link";
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
  stages: { key: string; label: string }[];
  kpis?: string[];
  enabled: boolean;
}
interface MemberRole {
  userId: string;
  stageKeys: string[];
}
interface Icp {
  industries?: string[];
  minCompanySize?: number;
  minBudgetMinor?: number;
  notes?: string;
}
interface TeamRow {
  id: string;
  name: string;
  model: Model;
  memberUserIds: string[];
  memberRoles?: MemberRole[];
  playbookKey?: string;
  icp?: Icp;
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
  const [model, setModel] = useState<Model>("conveyor");
  const [members, setMembers] = useState<string[]>([]);
  const [playbookKey, setPlaybookKey] = useState("");
  // stageKey -> userIds who own that stage. Built into memberRoles on submit.
  const [stageOwners, setStageOwners] = useState<Record<string, string[]>>({});
  const [industries, setIndustries] = useState("");
  const [minCompanySize, setMinCompanySize] = useState("");
  const [minBudget, setMinBudget] = useState("");
  const [icpNotes, setIcpNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modelPlaybooks = playbooks.filter((p) => p.model === model);
  const chosenPlaybook = modelPlaybooks.find((p) => p.key === playbookKey);

  function toggleMember(id: string) {
    setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }
  function toggleStageOwner(stageKey: string, userId: string) {
    setStageOwners((prev) => {
      const current = prev[stageKey] ?? [];
      const next = current.includes(userId) ? current.filter((x) => x !== userId) : [...current, userId];
      return { ...prev, [stageKey]: next };
    });
  }

  function reset() {
    setName(""); setModel("conveyor"); setMembers([]); setPlaybookKey("");
    setStageOwners({}); setIndustries(""); setMinCompanySize(""); setMinBudget(""); setIcpNotes("");
    setOpen(false);
  }

  async function create() {
    setError(null);
    if (!name.trim() || members.length === 0) {
      setError("A name and at least one member are required.");
      return;
    }
    // Invert stageOwners (stageKey -> userIds) into memberRoles (userId -> stageKeys).
    let memberRoles: MemberRole[] | undefined;
    if (model === "conveyor") {
      const byUser = new Map<string, string[]>();
      for (const [stageKey, userIds] of Object.entries(stageOwners)) {
        for (const userId of userIds) byUser.set(userId, [...(byUser.get(userId) ?? []), stageKey]);
      }
      memberRoles = [...byUser.entries()].map(([userId, stageKeys]) => ({ userId, stageKeys }));
    }
    const icp = industries.trim() || minCompanySize.trim() || minBudget.trim() || icpNotes.trim()
      ? {
          industries: industries.trim() ? industries.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
          minCompanySize: minCompanySize.trim() ? Number(minCompanySize) : undefined,
          minBudgetMinor: minBudget.trim() ? Math.round(Number(minBudget) * 100) : undefined,
          notes: icpNotes.trim() || undefined,
        }
      : undefined;
    setBusy(true);
    try {
      const res = await fetch("/api/conveyor-teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          model,
          memberUserIds: members,
          memberRoles: memberRoles?.length ? memberRoles : undefined,
          playbookKey: playbookKey || undefined,
          icp,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(b?.error ?? "Could not create this system.");
        return;
      }
      reset();
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
        alert(b?.error ?? "Could not delete that system.");
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">Sales systems</h2>
        <button onClick={() => setOpen((o) => !o)} className="btn-ghost text-xs">
          {open ? "Cancel" : "+ Add system"}
        </button>
      </div>

      {open && (
        <div className="glass space-y-3 p-4">
          {error && <p className="text-xs text-action">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="System name">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Outbound Team Alpha" className="inp" />
            </Field>
            <Field label="Type">
              <select
                value={model}
                onChange={(e) => { setModel(e.target.value as Model); setPlaybookKey(""); setStageOwners({}); }}
                className="inp"
              >
                <option value="conveyor">Conveyor Belt — stages hand off between people</option>
                <option value="individual">Individual Funnel — each member runs their own leads end to end</option>
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

          {model === "conveyor" && (
            <>
              <Field label="Playbook (defines the stages)">
                <select value={playbookKey} onChange={(e) => { setPlaybookKey(e.target.value); setStageOwners({}); }} className="inp">
                  <option value="">— none —</option>
                  {modelPlaybooks.map((p) => (
                    <option key={p.id} value={p.key}>{p.label}</option>
                  ))}
                </select>
              </Field>

              {chosenPlaybook && members.length > 0 && (
                <Field label="Who owns each stage — an employee can own more than one">
                  <div className="space-y-2 rounded-lg border border-border p-2">
                    {chosenPlaybook.stages.map((s) => (
                      <div key={s.key} className="flex flex-wrap items-center gap-1.5">
                        <span className="w-28 shrink-0 text-xs text-muted">{s.label}</span>
                        {members.map((userId) => {
                          const on = (stageOwners[s.key] ?? []).includes(userId);
                          return (
                            <button
                              key={userId}
                              onClick={() => toggleStageOwner(s.key, userId)}
                              className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                                on ? "border-teal bg-teal/15 text-fg" : "border-border text-muted hover:text-fg"
                              }`}
                            >
                              {nameById[userId] ?? userId}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </Field>
              )}
            </>
          )}

          <Field label="Ideal customer profile (optional)">
            <div className="grid gap-2 sm:grid-cols-3">
              <input value={industries} onChange={(e) => setIndustries(e.target.value)} placeholder="Industries, comma-separated" className="inp" />
              <input value={minCompanySize} onChange={(e) => setMinCompanySize(e.target.value)} inputMode="numeric" placeholder="Min company size" className="inp" />
              <input value={minBudget} onChange={(e) => setMinBudget(e.target.value)} inputMode="numeric" placeholder="Min budget (₹)" className="inp" />
            </div>
            <input value={icpNotes} onChange={(e) => setIcpNotes(e.target.value)} placeholder="Notes — what a good-fit lead looks like" className="inp mt-2" />
          </Field>

          <div className="flex justify-end">
            <button onClick={create} disabled={busy} className="btn-accent text-sm">
              {busy ? "Creating…" : "Create system"}
            </button>
          </div>
        </div>
      )}

      {teams.length === 0 ? (
        <Empty text="No sales systems yet. A conveyor system shares access to its leads and hands ownership off stage to stage; an individual system just groups reps who each run their own leads end to end." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((t) => (
            <div key={t.id} className="glass flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link href={`/admin/sales-models/${t.id}`} className="text-sm font-medium text-fg hover:text-accent">{t.name}</Link>
                  <div className="text-xs text-muted">
                    {t.model === "conveyor" ? "Conveyor Belt" : "Individual Funnel"} · {t.memberUserIds.length} member{t.memberUserIds.length === 1 ? "" : "s"}
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
              {t.icp && (t.icp.industries?.length || t.icp.notes) && (
                <p className="t-micro">
                  ICP: {[...(t.icp.industries ?? []), t.icp.notes].filter(Boolean).join(" · ")}
                </p>
              )}
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
