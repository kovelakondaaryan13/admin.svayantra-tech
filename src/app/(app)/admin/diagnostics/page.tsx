import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isOwner } from "@/lib/iam";
import { summary } from "@/lib/telemetry";
import { fmtDateTime } from "@/lib/format";
import { WorkspacePage, Section, Badge, KpiRow, StatTile } from "@/components/ds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KIND_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral" | "brand"> = {
  ingestion: "info", search: "brand", ai: "warning", upload: "info", error: "danger", slow: "warning", feature: "neutral",
};

export default async function DiagnosticsPage() {
  const user = await requireUser();
  if (!isOwner(user)) redirect("/home");
  const { counts, recentFailures, total } = await summary();

  const byKind = (k: string) => counts.filter((c) => c.kind === k).reduce((s, c) => s + c.count, 0);

  return (
    <WorkspacePage
      eyebrow="Administration"
      title="Diagnostics"
      subtitle="Lightweight instrumentation for the team building STOS — usage, failures, and misses. Not shown to end users."
      max="max-w-4xl"
    >
      <Section variant="plain">
        <KpiRow>
          <StatTile label="Events captured" value={String(total)} icon="📊" />
          <StatTile label="Ingestion" value={String(byKind("ingestion"))} icon="📄" />
          <StatTile label="Searches" value={String(byKind("search"))} icon="🔍" />
          <StatTile label="Failures / misses" value={String(recentFailures.length)} tone={recentFailures.length ? "bad" : "good"} icon="⚠️" />
        </KpiRow>
      </Section>

      <Section title="Event counts">
        {counts.length === 0 ? (
          <p className="px-1 py-2 text-sm text-muted">No events yet. Usage will appear here as the team works.</p>
        ) : (
          <div className="space-y-1">
            {counts.map((c) => (
              <div key={`${c.kind}:${c.event}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-overlay/[0.03]">
                <span className="flex items-center gap-2">
                  <Badge variant={KIND_TONE[c.kind] ?? "neutral"}>{c.kind}</Badge>
                  <span className="text-fg">{c.event}</span>
                </span>
                <span className="t-meta">{c.count}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Recent failures & misses">
        {recentFailures.length === 0 ? (
          <p className="px-1 py-2 text-sm text-muted">None. 🎉</p>
        ) : (
          <div className="space-y-1">
            {recentFailures.map((f, i) => (
              <div key={i} className="flex items-start justify-between gap-3 rounded-lg px-2 py-1.5 text-sm">
                <span className="flex min-w-0 items-start gap-2">
                  <Badge variant={f.event === "miss" ? "warning" : "danger"}>{f.kind}·{f.event}</Badge>
                  <span className="min-w-0 truncate text-fg/90">{JSON.stringify(f.meta)}</span>
                </span>
                <span className="t-micro shrink-0">{fmtDateTime(f.at)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </WorkspacePage>
  );
}
