import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isOwner } from "@/lib/iam";
import { aiUsageService } from "@/services/ai-usage-service";
import { WorkspacePage } from "@/components/ds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default async function AiUsagePage() {
  const user = await requireUser();
  if (!isOwner(user)) redirect("/home");

  const data = await aiUsageService.summary(user, 30);

  return (
    <WorkspacePage
      eyebrow="Administration"
      title="AI Usage"
      subtitle="Token consumption and estimated costs per team member — last 30 days."
      max="max-w-4xl"
    >
      {/* Org-wide totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total Tokens" value={fmt(data.totalTokens)} />
        <Stat label="Requests" value={String(data.requestCount)} />
        <Stat label="Est. Cost" value={usd(data.estimatedCost)} />
        <Stat label="Avg / Request" value={data.requestCount > 0 ? fmt(Math.round(data.totalTokens / data.requestCount)) : "—"} />
      </div>

      {/* Per-user breakdown */}
      <section className="glass mt-6 overflow-hidden">
        <div className="border-b border-overlay/5 px-5 py-3">
          <h2 className="text-sm font-semibold text-fg">Usage by Employee</h2>
        </div>
        {data.byUser.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">No AI usage recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-overlay/5 text-left text-xs text-muted">
                  <th className="px-5 py-2.5 font-medium">Employee</th>
                  <th className="px-3 py-2.5 font-medium text-right">Requests</th>
                  <th className="px-3 py-2.5 font-medium text-right">Input</th>
                  <th className="px-3 py-2.5 font-medium text-right">Output</th>
                  <th className="px-3 py-2.5 font-medium text-right">Total</th>
                  <th className="px-5 py-2.5 font-medium text-right">Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {data.byUser.map((u) => {
                  const pct = data.totalTokens > 0 ? (u.totalTokens / data.totalTokens) * 100 : 0;
                  return (
                    <tr key={u.userId} className="border-b border-overlay/[0.03] hover:bg-overlay/[0.02]">
                      <td className="px-5 py-3">
                        <div className="font-medium text-fg">{u.name}</div>
                        <div className="text-xs text-muted">{u.email}</div>
                      </td>
                      <td className="px-3 py-3 text-right text-muted">{u.requestCount}</td>
                      <td className="px-3 py-3 text-right text-muted">{fmt(u.totalInput)}</td>
                      <td className="px-3 py-3 text-right text-muted">{fmt(u.totalOutput)}</td>
                      <td className="px-3 py-3 text-right">
                        <span className="font-medium text-fg">{fmt(u.totalTokens)}</span>
                        <span className="ml-1.5 text-xs text-muted">({pct.toFixed(0)}%)</span>
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-fg">{usd(u.estimatedCost)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-3 text-xs text-muted">
        Cost estimates based on Sonnet 4.5 pricing ($3/M input, $15/M output). Actual billing may vary.
      </p>
    </WorkspacePage>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold text-fg">{value}</div>
    </div>
  );
}
