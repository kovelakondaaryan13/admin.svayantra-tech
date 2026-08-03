import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isOwner } from "@/lib/iam";
import {
  PageHeader, Section, KpiRow, StatTile, Badge, Avatar,
  AICallout, AIInsight, Timeline, ActivityFeed, ObjectPage,
} from "@/components/ds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Living component catalogue for STOS Design System v2. Owner-only review surface — every
 * primitive with representative data. This is the artifact to sign off before rollout.
 * See STOS_DESIGN_SYSTEM.md.
 */
export default async function DesignSystemPage() {
  const user = await requireUser();
  if (!isOwner(user)) redirect("/home");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader
        hero
        eyebrow="Design System v2"
        title={<>STOS <span className="text-gradient">design language</span></>}
        subtitle="The catalogue every screen composes from. Crop any of these — it should read as STOS."
        actions={<button className="btn-accent">Primary action</button>}
      />

      <Section title="Buttons & badges">
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-accent">Primary</button>
          <button className="btn-action">Urgent</button>
          <button className="btn-ghost">Ghost</button>
          <span className="mx-2 h-5 w-px bg-border" />
          <Badge variant="brand">Brand</Badge>
          <Badge variant="success">On track</Badge>
          <Badge variant="warning">At risk</Badge>
          <Badge variant="danger">Blocked</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="neutral">Neutral</Badge>
          <span className="mx-2 h-5 w-px bg-border" />
          <Avatar name="Aryan Goud" /><Avatar name="Priya Sharma" size="sm" />
        </div>
      </Section>

      <Section title="KPI presentation (KpiRow + StatTile)" variant="plain">
        <KpiRow>
          <StatTile label="Booked" value="₹24.4L" tone="good" icon="💰" delta={{ dir: "up", text: "+8%" }} />
          <StatTile label="Weighted forecast" value="₹23.5L" tone="brand" icon="📈" />
          <StatTile label="Open pipeline" value="₹52.0L" icon="🎯" />
          <StatTile label="Win rate" value="31%" tone="good" icon="🏆" delta={{ dir: "down", text: "-2%" }} />
        </KpiRow>
      </Section>

      <Section title="AI callout (the one AI treatment)" variant="plain">
        <AICallout
          title="Executive briefing"
          confidence="high"
          action={<button className="btn-action px-3 py-1.5 text-xs">Refresh</button>}
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg/90">
            Good morning. Two approvals worth ₹16L are waiting — clear those first. Qualification is
            this week&apos;s bottleneck across both conveyor teams. Priya is overloaded (7 open, 1 overdue).
          </p>
        </AICallout>
        <div className="mt-3"><AIInsight>This deal has stalled 6 days past its SLA — draft a follow-up?</AIInsight></div>
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Timeline">
          <Timeline
            items={[
              { id: "1", title: "Deal won — Rajkot Auto (₹9.5L)", time: "5d", tone: "won" },
              { id: "2", title: "Proposal sent — MediCore", time: "6d", tone: "note" },
              { id: "3", title: "Lost — Lex & Associates (price)", time: "20d", tone: "lost" },
              { id: "4", title: "Meeting booked — Cloudwave", time: "22d", tone: "neutral" },
            ]}
          />
        </Section>
        <Section title="Activity feed">
          <ActivityFeed
            items={[
              { id: "1", actor: "Priya Sharma", summary: "logged a call on NCR Digital", time: "2h" },
              { id: "2", actor: "Rahul Verma", summary: "approved a quote (₹6.5L)", time: "5h" },
              { id: "3", actor: "Deblina", summary: "published the case-study page", time: "1d" },
            ]}
          />
        </Section>
      </div>

      <Section title="Object page template (Company / Person / Deal / Department)" variant="plain">
        <p className="mb-3 t-meta">Every first-class object uses this exact shell.</p>
        <ObjectPage
          kind="Company"
          name="MoneyPal"
          logo="🏢"
          statuses={[{ label: "Client", variant: "brand" }, { label: "On track", variant: "success" }, { label: "Renewal in 4mo", variant: "neutral" }]}
          aiSummary="MoneyPal is a healthy SaaS account (₹80Cr est. revenue). Two active deals, renewal in 4 months. Last touch 3 days ago; sentiment positive."
          actions={<><button className="btn-ghost text-xs">Log touch</button><button className="btn-accent text-xs">New deal</button></>}
          tabs={[
            { key: "overview", label: "Overview", content: (
              <KpiRow>
                <StatTile label="Open deals" value="2" icon="🎯" />
                <StatTile label="Won (LTV)" value="₹12L" tone="good" />
                <StatTile label="People" value="4" />
                <StatTile label="Health" value="Green" tone="good" />
              </KpiRow>
            ) },
            { key: "timeline", label: "Timeline", content: (
              <Section><Timeline items={[{ id: "1", title: "Discovery completed", time: "12d", tone: "note" }, { id: "2", title: "Proposal sent", time: "6d", tone: "note" }]} /></Section>
            ) },
            { key: "work", label: "Work", content: <Section><p className="text-sm text-muted">Deals + tasks for this account.</p></Section> },
            { key: "meetings", label: "Meetings", content: <Section><p className="text-sm text-muted">Past + upcoming meetings.</p></Section> },
            { key: "knowledge", label: "Knowledge", content: <Section><p className="text-sm text-muted">Notes, docs, and the account dossier.</p></Section> },
            { key: "relationships", label: "Relationships", content: <Section><p className="text-sm text-muted">People + org relationships.</p></Section> },
            { key: "analytics", label: "Analytics", content: <Section><p className="text-sm text-muted">Revenue + engagement trends.</p></Section> },
          ]}
        />
      </Section>
    </div>
  );
}
