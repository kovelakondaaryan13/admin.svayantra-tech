"use client";
/**
 * Executive Home — built on the STOS Design System v2 primitives, composed as WORKSPACE ZONES
 * (not floating cards): Company Pulse → AI Briefing → Focus → Today's Schedule → What happened.
 * See STOS_DESIGN_SYSTEM.md §4.
 */
import { useState } from "react";
import Link from "next/link";
import type { CommandCenter } from "@/services/command-center-service";
import { Section, KpiRow, StatTile, AICallout, AIInsight, Timeline, BarChart, BarChartH, EmptyState, type TimelineItem, type BarDatum, Markdown } from "@/components/ds";
import { fmtLakhCr as money, monthLabel as MONTH_LABEL } from "@/lib/format";
import { MyTasks, type MyTaskRow } from "@/components/home/my-tasks";

export function ExecutiveDashboard({
  cc,
  meetingsToday,
  overnight,
  myTasks,
}: {
  cc: CommandCenter;
  // Times are formatted on the SERVER and passed as strings — never format dates in this client
  // component, or SSR/CSR (locale + timezone) will disagree and hydration breaks.
  meetingsToday: { title: string; time: string }[];
  overnight: { summary: string; time: string; tone: "won" | "lost" | "note" }[];
  myTasks: MyTaskRow[];
}) {
  const [brief, setBrief] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch("/api/command-center/briefing", { method: "POST" });
      const b = await res.json();
      setBrief(res.ok ? b.data.briefing : b?.error ?? "Could not generate the briefing.");
    } finally {
      setBusy(false);
    }
  }

  // Focus = the few things that need the founder now.
  const focus: TimelineItem[] = [
    ...cc.blocked.items.map((s, i) => ({ id: `b${i}`, title: s, meta: "Blocked", tone: "lost" as const })),
    ...cc.atRisk.map((r, i) => ({ id: `r${i}`, title: r.name, meta: `At risk · ${r.reason}`, tone: "lost" as const })),
    ...cc.needHelp.map((h) => ({ id: `h${h.userId}`, title: `${h.name} is overloaded`, meta: `${h.openCount}${h.capacity ? "/" + h.capacity : ""} open · ${h.overdue} overdue`, tone: "note" as const })),
  ].slice(0, 6);

  const schedule: TimelineItem[] = meetingsToday.map((m, i) => ({
    id: `m${i}`,
    title: m.title,
    time: m.time,
    tone: "neutral" as const,
  }));

  const happened: TimelineItem[] = overnight.map((a, i) => ({
    id: `y${i}`,
    title: a.summary,
    time: a.time,
    tone: a.tone,
  }));

  return (
    <div className="space-y-6">
      {/* Zone 1 — Company Pulse */}
      <Section title="Company pulse" variant="plain">
        <KpiRow>
          <StatTile label="Booked" value={money(cc.forecast.bookedMinor)} tone="good" icon="💰" />
          <StatTile label="Weighted forecast" value={money(cc.forecast.weightedPipelineMinor)} tone="brand" icon="📈" />
          <StatTile label="Open pipeline" value={money(cc.forecast.totalPipelineMinor)} icon="🎯" />
          <StatTile label="Win rate" value={cc.forecast.winRate == null ? "—" : `${cc.forecast.winRate}%`} tone="good" icon="🏆" />
        </KpiRow>
      </Section>

      {/* Zone 1b — Operational pulse */}
      <Section variant="plain">
        <KpiRow>
          <StatTile label="Open tasks" value={String(cc.taskStats.open)} icon="✅" delta={cc.taskStats.overdue > 0 ? { dir: "up" as const, text: `${cc.taskStats.overdue} overdue`, tone: "bad" as const } : undefined} />
          <StatTile label="Completed today" value={String(cc.taskStats.completedToday)} tone="good" icon="✓" />
          <StatTile label="Team members" value={String(cc.utilization.length)} icon="👥" />
          <StatTile label="At risk" value={String(cc.atRisk.length)} tone={cc.atRisk.length > 0 ? "bad" : "good"} icon="⚠️" />
        </KpiRow>
      </Section>

      {/* Zone 2 — AI Briefing */}
      <AICallout
        title="Executive briefing"
        action={<button onClick={generate} disabled={busy} className="btn-action px-3 py-1.5 text-xs">{busy ? "Thinking…" : brief ? "Refresh" : "Generate"}</button>}
        thinking={busy && !brief}
      >
        {brief ? (
          <Markdown content={brief} />
        ) : (
          <p className="text-sm text-muted">Your Chief of Staff summarizes what happened, what needs you today, and what to do about it.</p>
        )}
      </AICallout>

      {/* Zone 2b — Decision charts */}
      {(cc.pipelineByStage.some(d => d.value > 0) || cc.utilization.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {cc.pipelineByStage.some(d => d.value > 0) && (
            <Section title="Pipeline by stage" action={<span className="t-micro">where revenue sits</span>}>
              <BarChart data={cc.pipelineByStage} />
            </Section>
          )}
          {cc.utilization.length > 0 && (
            <Section title="Workload by team member" action={<span className="t-micro">who needs help</span>}>
              <BarChartH data={cc.utilization.slice(0, 8).map(u => ({
                label: u.name.split(' ')[0],
                value: u.score,
                display: `${u.score} / 100`,
                tone: u.overloaded ? 'bad' as const : undefined,
              }))} />
            </Section>
          )}
        </div>
      )}

      {/* Zone 2b-2 — Pipeline Analytics */}
      <Section title="Pipeline analytics" variant="plain">
        {!cc.hasPipelineData ? (
          <EmptyState
            icon="📈"
            title="No pipeline data yet"
            description="Analytics populate once leads start moving through the pipeline — add your first lead to see revenue trend, win rate, and conversion."
            action={<Link href="/work" className="btn-ghost text-xs">Go to Work →</Link>}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Section title="Monthly revenue trend" action={<span className="t-micro">won deals, last 6 months</span>}>
              <BarChart data={cc.revenueTrendByMonth.map((r): BarDatum => ({
                label: MONTH_LABEL(r.month),
                value: r.wonMinor,
                display: money(r.wonMinor),
              }))} />
            </Section>
            <Section title="Monthly win rate" action={<span className="t-micro">won / (won + lost)</span>}>
              <BarChart data={cc.winRateByMonth.map((r): BarDatum => ({
                label: MONTH_LABEL(r.month),
                value: r.winRatePct ?? 0,
                display: r.winRatePct == null ? "—" : `${r.winRatePct}%`,
              }))} />
            </Section>
            <Section title="Lead source" action={<span className="t-micro">where deals originate</span>}>
              <BarChartH data={cc.bySource.slice(0, 8).map((s): BarDatum => ({ label: s.source, value: s.count, display: String(s.count) }))} />
            </Section>
            <Section title="Stage conversion funnel" action={<span className="t-micro">% carrying to the next stage</span>}>
              <BarChartH data={cc.funnel.map((f): BarDatum => ({
                label: f.stage,
                value: f.count,
                display: f.conversionFromPrevPct == null ? `${f.count}` : `${f.count} (${f.conversionFromPrevPct}%)`,
              }))} />
            </Section>
          </div>
        )}
        {cc.hasPipelineData && cc.avgSalesCycleDays != null && (
          <p className="mt-3 t-micro">Average sales cycle: <span className="text-fg">{cc.avgSalesCycleDays} days</span> (won deals, created → closed).</p>
        )}
      </Section>

      {/* Zone 2c — At-risk deals insight */}
      {cc.atRisk.length > 0 && (
        <AIInsight>
          <b>{cc.atRisk.length}</b> deal{cc.atRisk.length === 1 ? ' needs' : 's need'} attention
          {' '}&mdash; {cc.atRisk.slice(0, 3).map((r, i) => (
            <span key={i}>{i > 0 ? ', ' : ''}<b>{r.name}</b> ({r.stage}: {r.reason})</span>
          ))}{cc.atRisk.length > 3 ? `, +${cc.atRisk.length - 3} more` : ''}.
        </AIInsight>
      )}

      {/* Zone 3 + 4 — Focus & Today */}
      <div className="grid gap-4 md:grid-cols-2">
        <Section
          title="Focus — needs you now"
          action={<Link href="/command" className="text-xs text-muted transition-colors hover:text-accent">command center →</Link>}
        >
          {focus.length === 0 ? <p className="px-1 py-2 text-sm text-muted">You&apos;re clear. Nothing blocking.</p> : <Timeline items={focus} compact />}
        </Section>

        <Section
          title="Today's schedule"
          action={<Link href="/work" className="text-xs text-muted transition-colors hover:text-accent">calendar →</Link>}
        >
          {schedule.length === 0 ? <p className="px-1 py-2 text-sm text-muted">No meetings today.</p> : <Timeline items={schedule} compact />}
        </Section>
      </div>

      <MyTasks tasks={myTasks} />

      {/* Zone 5 — What happened */}
      <Section title={`What happened · ${cc.yesterday.total} in 48h`}>
        <Timeline items={happened} />
      </Section>
    </div>
  );
}
