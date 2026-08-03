import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/iam";
import { leadService } from "@/services/lead-service";
import { LeadsGrid } from "@/components/work/leads-grid";
import { WorkTabs } from "@/components/work/work-tabs";
import { CollectionPage, Section, KpiRow, StatTile, BarChart, AIInsight, type BarDatum } from "@/components/ds";
import { fmtLakhCr as inrLakh } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPEN_STAGES = ["new", "qualified", "meeting", "proposal", "negotiation"] as const;
const STUCK_STAGES = new Set(["proposal", "negotiation"]);
const STUCK_DAYS = 14;
const DAY = 86400000;

export default async function WorkPage() {
  const user = await requireUser();
  if (!can(user, "crm.read")) redirect("/home");
  const leads = await leadService.list(user);

  const now = Date.now();
  const open = leads.filter((l) => (OPEN_STAGES as readonly string[]).includes(l.stage));
  const pipelineMinor = open.reduce((s, l) => s + (l.value?.amountMinor ?? 0), 0);
  const won = leads.filter((l) => l.stage === "won").length;
  const lost = leads.filter((l) => l.stage === "lost").length;
  const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null;

  // Movement — only where a real time basis exists. New leads this week vs the prior week
  // (createdAt is real data; no fabricated deltas). Pipeline-value trend needs snapshots we don't
  // keep yet, so that tile shows no delta rather than a made-up one.
  const newThisWeek = leads.filter((l) => now - new Date(l.createdAt).getTime() <= 7 * DAY).length;
  const newPrevWeek = leads.filter((l) => {
    const age = now - new Date(l.createdAt).getTime();
    return age > 7 * DAY && age <= 14 * DAY;
  }).length;
  const leadDelta =
    newPrevWeek > 0
      ? { dir: (newThisWeek >= newPrevWeek ? "up" : "down") as "up" | "down", text: `${Math.round(((newThisWeek - newPrevWeek) / newPrevWeek) * 100)}% vs last week`, tone: "good" as const }
      : undefined;

  // AI "what should happen next?" — deals sitting too long in a late stage. Age = last stage
  // change (or creation if none). Derived from real timestamps, never invented.
  const lastMoveAt = (l: (typeof leads)[number]) => {
    const h = l.stageHistory ?? [];
    return new Date(h.length ? h[h.length - 1].at : l.createdAt).getTime();
  };
  const stuck = open
    .filter((l) => STUCK_STAGES.has(l.stage) && (now - lastMoveAt(l)) / DAY >= STUCK_DAYS)
    .sort((a, b) => lastMoveAt(a) - lastMoveAt(b));

  // Decision charts: where is the value, and where are deals clustering? Open stages only.
  const valueByStage: BarDatum[] = OPEN_STAGES.map((s) => {
    const minor = leads.filter((l) => l.stage === s).reduce((sum, l) => sum + (l.value?.amountMinor ?? 0), 0);
    return { label: s, value: minor, display: inrLakh(minor) };
  });
  const countByStage: BarDatum[] = OPEN_STAGES.map((s) => ({ label: s, value: leads.filter((l) => l.stage === s).length, display: String(leads.filter((l) => l.stage === s).length) }));
  const hasPipeline = valueByStage.some((d) => d.value > 0);

  return (
    <CollectionPage
      eyebrow="Work"
      title="Pipeline"
      subtitle="Your leads, clients, and deals — one connected workspace."
      tabs={<WorkTabs showConveyor={can(user, "users.read")} />}
    >
      {/* Decision metrics — "what is happening?" (few, decision-relevant; not a metric wall). */}
      <Section variant="plain">
        <KpiRow>
          <StatTile label="Open pipeline" value={inrLakh(pipelineMinor)} tone="brand" icon="📈" hero />
          <StatTile label="Open deals" value={String(open.length)} icon="🎯" />
          <StatTile label="New leads (7d)" value={String(newThisWeek)} icon="✨" delta={leadDelta} />
          <StatTile label="Win rate" value={winRate === null ? "—" : `${winRate}%`} tone={winRate !== null && winRate >= 50 ? "good" : "neutral"} icon="🏆" />
        </KpiRow>
      </Section>

      {/* Decision charts — "why is it happening?" */}
      {hasPipeline && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Section title="Pipeline value by stage" action={<span className="t-micro">why revenue is where it is</span>}>
            <BarChart data={valueByStage} />
          </Section>
          <Section title="Deals by stage" action={<span className="t-micro">where it&apos;s clustering</span>}>
            <BarChart data={countByStage} />
          </Section>
        </div>
      )}

      {/* AI — "what should happen next?" (only when there's a real, actionable finding). */}
      {stuck.length > 0 && (
        <AIInsight>
          <b>{stuck.length}</b> deal{stuck.length === 1 ? " has" : "s have"} been in proposal/negotiation for {STUCK_DAYS}+ days
          {" "}— e.g.{" "}
          {stuck.slice(0, 3).map((l, i) => (
            <span key={l.id}>
              {i > 0 ? ", " : ""}
              <a href={`/work/${l.id}`} className="text-accent hover:underline">{l.name}</a>
            </span>
          ))}
          . Recommend a follow-up touch to unstick them.
        </AIInsight>
      )}

      <Section variant="plain">
        <LeadsGrid
          leads={leads.map((l) => ({
            id: l.id,
            name: l.name,
            company: l.company,
            email: l.email,
            stage: l.stage,
            source: l.source,
            value: l.value,
          }))}
          canWrite={can(user, "crm.write")}
          canDelete={can(user, "crm.delete")}
          canAdvance={can(user, "sales.write")}
        />
      </Section>
    </CollectionPage>
  );
}
