/**
 * Read-only Departments overview — surfaces each department's KPIs + shared resources
 * (stored in orgUnit.metadata) alongside headcount, above the org-structure console.
 */
export interface DeptCard {
  id: string;
  name: string;
  managerName?: string;
  memberCount: number;
  headcountCapacity?: number;
  kpis: { label: string; value: string }[];
  resources: string[];
}

const ICON: Record<string, string> = {
  "Founder's Office": "👑",
  Sales: "📈",
  Marketing: "📣",
  Operations: "⚙️",
  Finance: "💰",
  Product: "🧩",
  Engineering: "🛠️",
  HR: "🧑‍🤝‍🧑",
};

export function DepartmentKpis({ departments }: { departments: DeptCard[] }) {
  const withData = departments.filter((d) => d.kpis.length > 0 || d.resources.length > 0);
  if (withData.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-tight text-fg">Departments</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {withData.map((d) => (
          <div key={d.id} className="glass glass-hover flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-overlay/[0.05] text-base">
                  {ICON[d.name] ?? "🏢"}
                </span>
                <div>
                  <div className="text-sm font-medium text-fg">{d.name}</div>
                  <div className="text-[11px] text-muted">
                    {d.memberCount}{d.headcountCapacity ? `/${d.headcountCapacity}` : ""} people
                    {d.managerName ? ` · ${d.managerName}` : ""}
                  </div>
                </div>
              </div>
            </div>

            {d.kpis.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {d.kpis.map((k) => (
                  <div key={k.label} className="rounded-lg border border-border bg-overlay/[0.02] px-2 py-1.5">
                    <div className="text-sm font-semibold text-fg">{k.value}</div>
                    <div className="text-[10px] leading-tight text-muted">{k.label}</div>
                  </div>
                ))}
              </div>
            )}

            {d.resources.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {d.resources.map((r) => (
                  <span key={r} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-fg/70">
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
