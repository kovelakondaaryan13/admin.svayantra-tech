import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/iam";
import { companyService } from "@/services/company-service";
import { leadService } from "@/services/lead-service";
import { fmtLakhCr as inr } from "@/lib/format";
import { CollectionPage, Section, Badge } from "@/components/ds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPEN = ["new", "qualified", "meeting", "proposal", "negotiation"];

export default async function CompaniesPage() {
  const user = await requireUser();
  if (!can(user, "crm.read")) redirect("/home");

  const [companies, leads] = await Promise.all([
    companyService.list(user).catch(() => []),
    leadService.list(user).catch(() => []),
  ]);

  const stats = new Map<string, { open: number; pipelineMinor: number; won: number }>();
  for (const l of leads) {
    const key = l.companyId && companies.some((c) => c.id === l.companyId) ? l.companyId : companies.find((c) => c.name === l.company)?.id;
    if (!key) continue;
    const s = stats.get(key) ?? { open: 0, pipelineMinor: 0, won: 0 };
    if (OPEN.includes(l.stage)) { s.open += 1; s.pipelineMinor += l.value?.amountMinor ?? 0; }
    if (l.stage === "won") s.won += 1;
    stats.set(key, s);
  }

  return (
    <CollectionPage
      eyebrow="Companies"
      title="Book of business"
      subtitle="Every account — prospects and clients — as a complete workspace."
    >
      {companies.length === 0 ? (
        <Section variant="plain">
          <p className="px-1 py-6 text-sm text-muted">No companies yet.</p>
        </Section>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => {
            const s = stats.get(c.id) ?? { open: 0, pipelineMinor: 0, won: 0 };
            return (
              <Link key={c.id} href={`/companies/${c.id}`} className="glass glass-hover flex flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-lg">🏢</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-fg">{c.name}</div>
                    <div className="t-micro">{c.industry ?? "—"}{c.revenueEstimate ? ` · ${c.revenueEstimate}` : ""}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="brand">{s.open} open</Badge>
                  {s.won > 0 && <Badge variant="success">{s.won} won</Badge>}
                  {s.pipelineMinor > 0 && <span className="t-micro">{inr(s.pipelineMinor)} pipeline</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </CollectionPage>
  );
}
