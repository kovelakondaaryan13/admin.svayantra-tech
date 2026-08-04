"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ds";

interface Row {
  id: string;
  name: string;
  email: string;
  personalEmail?: string;
  roleKey: string;
  status: string;
  title?: string;
  departmentId?: string;
  managerUserId?: string;
  capacity?: number;
  defaultExecutionModel?: "individual" | "conveyor";
  kpis?: { label: string; value: string }[];
}

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}
interface Ref {
  id: string;
  name: string;
}
interface ManagerRef {
  userId: string;
  name: string;
}

export function EmployeesTable({
  employees,
  roleOptions,
  canEdit,
  departments = [],
  managers = [],
  allowCreate = false,
  title = "Employee Directory",
  subtitle = "Manage roles, status, and access across the organization.",
}: {
  employees: Row[];
  roleOptions: { key: string; label: string }[];
  canEdit: boolean;
  departments?: Ref[];
  managers?: ManagerRef[];
  allowCreate?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const [savingId, setSavingId] = useState<string | null>(null);
  const admin = allowCreate && canEdit;
  const deptName = (id?: string) => departments.find((d) => d.id === id)?.name ?? "—";

  async function patch(id: string, body: Record<string, unknown>) {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        alert(b?.error ?? "Could not save that change.");
      }
      router.refresh();
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={admin ? <AddEmployee roleOptions={roleOptions} departments={departments} managers={managers} /> : undefined}
      />

      {employees.length === 0 ? (
        <EmptyState title="No employees yet" hint="Add your first team member with “+ Add employee”." />
      ) : (
        <div className="glass overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-overlay/[0.03] text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Role</th>
                {admin && <th className="px-4 py-2 font-medium">Department</th>}
                {admin && <th className="px-4 py-2 font-medium">Manager</th>}
                {admin && <th className="px-4 py-2 font-medium">Model</th>}
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-t border-border align-top">
                  <td className="px-4 py-2">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent/30 to-teal/30 text-[11px] font-semibold text-fg">
                        {initials(e.name)}
                      </span>
                      <div className="min-w-0">
                        <Link href={`/people/${e.id}`} className="text-fg hover:text-accent">{e.name}</Link>
                        <div className="text-xs text-muted">{e.title ? `${e.title} · ` : ""}{e.email}</div>
                        {e.personalEmail && <div className="text-[11px] text-faint">{e.personalEmail}</div>}
                        {e.kpis && e.kpis.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {e.kpis.map((k) => (
                              <span key={k.label} className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted">
                                {k.label} <span className="text-fg/80">{k.value}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    {canEdit ? (
                      <select
                        defaultValue={e.roleKey}
                        disabled={savingId === e.id}
                        onChange={(ev) => patch(e.id, { roleKey: ev.target.value })}
                        className="rounded border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
                      >
                        {!roleOptions.find((r) => r.key === e.roleKey) && (
                          <option value={e.roleKey}>{e.roleKey} (custom)</option>
                        )}
                        {roleOptions.map((r) => (
                          <option key={r.key} value={r.key}>{r.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-muted">{e.roleKey}</span>
                    )}
                  </td>
                  {admin && (
                    <td className="px-4 py-2">
                      <select
                        defaultValue={e.departmentId ?? ""}
                        disabled={savingId === e.id}
                        onChange={(ev) => patch(e.id, { departmentId: ev.target.value })}
                        className="rounded border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
                      >
                        <option value="">{departments.length ? "— none —" : deptName(e.departmentId)}</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  {admin && (
                    <td className="px-4 py-2">
                      <select
                        defaultValue={e.managerUserId ?? ""}
                        disabled={savingId === e.id}
                        onChange={(ev) => patch(e.id, { managerUserId: ev.target.value })}
                        className="rounded border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
                      >
                        <option value="">— none —</option>
                        {managers.filter((m) => m.userId).map((m) => (
                          <option key={m.userId} value={m.userId}>{m.name}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  {admin && (
                    <td className="px-4 py-2">
                      <select
                        defaultValue={e.defaultExecutionModel ?? ""}
                        disabled={savingId === e.id}
                        onChange={(ev) => patch(e.id, { defaultExecutionModel: ev.target.value })}
                        className="rounded border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
                      >
                        <option value="">—</option>
                        <option value="individual">Individual</option>
                        <option value="conveyor">Conveyor</option>
                      </select>
                    </td>
                  )}
                  <td className="px-4 py-2">
                    {canEdit ? (
                      <select
                        defaultValue={e.status}
                        disabled={savingId === e.id}
                        onChange={(ev) => patch(e.id, { status: ev.target.value })}
                        className="rounded border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
                      >
                        {["active", "invited", "suspended"].map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={e.status === "active" ? "text-teal" : "text-muted"}>{e.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {admin && (
        <p className="mgr-hint text-xs text-muted">
          Managed here without code changes — your team is data. Departments live in
          Workspace › Organization; conveyor teams in Workspace › Sales models.
        </p>
      )}
    </div>
  );
}

function AddEmployee({
  roleOptions,
  departments,
  managers,
}: {
  roleOptions: { key: string; label: string }[];
  departments: Ref[];
  managers: ManagerRef[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleKey, setRoleKey] = useState(roleOptions[0]?.key ?? "sales_rep");
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [managerUserId, setManagerUserId] = useState("");
  const [capacity, setCapacity] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; temp?: string } | null>(null);

  async function submit() {
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          roleKey,
          title: title.trim() || undefined,
          departmentId: departmentId || undefined,
          managerUserId: managerUserId || undefined,
          capacity: capacity ? Number(capacity) : undefined,
          defaultExecutionModel: model || undefined,
        }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(b?.error ?? "Could not create employee.");
        return;
      }
      setCreated({ name: name.trim(), temp: b.data?.tempPassword });
      setName(""); setEmail(""); setTitle(""); setDepartmentId(""); setManagerUserId(""); setCapacity(""); setModel("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => { setOpen(true); setCreated(null); }} className="btn-accent text-sm">
        + Add employee
      </button>
    );
  }

  return (
    <div className="glass w-full max-w-md space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">Add employee</h2>
        <button onClick={() => setOpen(false)} className="text-xs text-muted hover:text-fg">close</button>
      </div>
      {error && <p className="text-xs text-action">{error}</p>}
      {created && (
        <div className="rounded-lg border border-teal/30 bg-teal/10 p-3 text-xs text-fg/90">
          Created <span className="font-medium">{created.name}</span>.{" "}
          {created.temp
            ? <>Temp password: <code className="rounded bg-black/30 px-1">{created.temp}</code> — share it so they can sign in and change it.</>
            : "Linked to an existing account."}
        </div>
      )}
      <div className="grid gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="inp" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="work email" className="inp" />
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Job title (optional)" className="inp" />
        <div className="grid grid-cols-2 gap-2">
          <select value={roleKey} onChange={(e) => setRoleKey(e.target.value)} className="inp">
            {roleOptions.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="inp">
            <option value="">Department…</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={managerUserId} onChange={(e) => setManagerUserId(e.target.value)} className="inp">
            <option value="">Reporting manager…</option>
            {managers.filter((m) => m.userId).map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
          </select>
          <select value={model} onChange={(e) => setModel(e.target.value)} className="inp">
            <option value="">Execution model…</option>
            <option value="individual">Individual Funnel</option>
            <option value="conveyor">Conveyor Belt</option>
          </select>
        </div>
        <input value={capacity} onChange={(e) => setCapacity(e.target.value)} inputMode="numeric" placeholder="Capacity (open work items)" className="inp" />
      </div>
      <div className="flex justify-end">
        <button onClick={submit} disabled={busy} className="btn-accent text-sm">
          {busy ? "Creating…" : "Create & invite"}
        </button>
      </div>
    </div>
  );
}
