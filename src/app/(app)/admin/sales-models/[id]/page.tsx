import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/iam";
import { conveyorTeamService } from "@/services/conveyor-team-service";
import { conveyorMetricsService } from "@/services/conveyor-metrics-service";
import { playbookService } from "@/services/playbook-service";
import { employeeService } from "@/services/employee-service";
import { leadService } from "@/services/lead-service";
import { NotFound } from "@/lib/errors";
import { fmtLakhCr } from "@/lib/format";
import { PageHeader, Section, KpiRow, StatTile, Badge, STAGE_BADGE } from "@/components/ds";
import { FileUploader } from "@/components/knowledge/file-uploader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SalesSystemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  let team;
  try {
    team = await conveyorTeamService.get(user, id);
  } catch (e) {
    if (e instanceof NotFound) notFound();
    throw e;
  }

  const model = team.model ?? "conveyor";
  const [playbooks, employees, allLeads, metrics] = await Promise.all([
    playbookService.list(user).catch(() => []),
    employeeService.list(user).catch(() => []),
    leadService.listLean(user).catch(() => []),
    model === "conveyor" ? conveyorMetricsService.summary(user).catch(() => null) : Promise.resolve(null),
  ]);

  const nameById: Record<string, string> = {};
  for (const e of employees) nameById[e.userId] = e.name;

  const playbook = team.playbookKey ? playbooks.find((p) => p.key === team.playbookKey) : undefined;
  const stageLabel = (key: string) => playbook?.stages.find((s) => s.key === key)?.label ?? key;

  const leads =
    model === "conveyor"
      ? allLeads.filter((l) => l.conveyorTeamId === id)
      : allLeads.filter((l) => l.executionModel === "individual" && team.memberUserIds.includes(l.ownerId));

  const teamMetrics = metrics?.teams.find((t) => t.teamId === id);
  const myStageKeys = team.memberRoles?.find((r) => r.userId === user.id)?.stageKeys ?? [];
  const isMember = team.memberUserIds.includes(user.id);
  const canManage = can(user, "sales.assign");
  const canUploadDocs = can(user, "documents.write");
  const canDeleteDocs = can(user, "documents.delete");

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        eyebrow={model === "conveyor" ? "Conveyor Belt system" : "Individual Funnel system"}
        title={team.name}
        subtitle={`${team.memberUserIds.length} member${team.memberUserIds.length === 1 ? "" : "s"}${playbook ? ` · ${playbook.label}` : ""}`}
        actions={<Link href="/admin/sales-models" className="btn-ghost text-xs">← Sales models</Link>}
      />

      {isMember && (
        <div className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-fg/90">
          {model === "conveyor"
            ? myStageKeys.length > 0
              ? <>Your stage{myStageKeys.length > 1 ? "s" : ""} here: <strong>{myStageKeys.map(stageLabel).join(", ")}</strong></>
              : "You're a member here, but no stage is assigned to you yet — ask an admin."
            : "You run your own leads end to end in this system."}
        </div>
      )}

      {model === "conveyor" && teamMetrics && (
        <Section title="Dashboard">
          <KpiRow>
            <StatTile label="Active leads" value={String(teamMetrics.activeLeads)} icon="🎯" />
            <StatTile label="SLA compliance" value={teamMetrics.slaCompliancePct != null ? `${teamMetrics.slaCompliancePct}%` : "—"} icon="⏱️" />
            <StatTile label="Avg handoff" value={teamMetrics.avgHandoffHours != null ? `${teamMetrics.avgHandoffHours}h` : "—"} icon="🔁" />
            <StatTile label="Conversion" value={teamMetrics.conversionPct != null ? `${teamMetrics.conversionPct}%` : "—"} icon="📈" />
          </KpiRow>
          {teamMetrics.bottleneckStage && (
            <p className="mt-2 t-micro">Bottleneck stage right now: <strong>{teamMetrics.bottleneckStage}</strong> ({teamMetrics.byStage.find((s) => s.stage === teamMetrics.bottleneckStage)?.count ?? 0} leads)</p>
          )}
        </Section>
      )}

      <Section title="Members">
        <div className="space-y-1.5">
          {team.memberUserIds.map((uid) => {
            const stages = (team.memberRoles?.find((r) => r.userId === uid)?.stageKeys ?? []).map(stageLabel);
            return (
              <div key={uid} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-overlay/[0.03]">
                <span className="text-fg">{nameById[uid] ?? uid}</span>
                <span className="t-micro">{model === "conveyor" ? (stages.length ? stages.join(", ") : "no stage assigned") : "runs own leads"}</span>
              </div>
            );
          })}
        </div>
      </Section>

      {team.icp && (team.icp.industries?.length || team.icp.minCompanySize || team.icp.minBudgetMinor || team.icp.notes) && (
        <Section title="Ideal customer profile">
          <div className="space-y-1 text-sm text-fg/90">
            {team.icp.industries?.length ? <p>Industries: {team.icp.industries.join(", ")}</p> : null}
            {team.icp.minCompanySize ? <p>Min company size: {team.icp.minCompanySize}</p> : null}
            {team.icp.minBudgetMinor ? <p>Min budget: {fmtLakhCr(team.icp.minBudgetMinor)}</p> : null}
            {team.icp.notes ? <p className="text-muted">{team.icp.notes}</p> : null}
          </div>
        </Section>
      )}

      <Section title={`Leads in this system (${leads.length})`}>
        {leads.length === 0 ? (
          <p className="px-1 py-2 text-sm text-muted">No leads assigned to this system yet.</p>
        ) : (
          <div className="space-y-1">
            {leads.map((l) => (
              <Link key={l.id} href={`/work/${l.id}`} className="flex items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-overlay/[0.03]">
                <span className="text-fg">{l.name}</span>
                <span className="flex items-center gap-2">
                  <Badge variant={STAGE_BADGE[l.stage] ?? "neutral"}>{l.stage}</Badge>
                  <span className="t-micro">{nameById[l.ownerId] ?? l.ownerId}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="Docs & SOPs">
        <FileUploader related={{ type: "conveyor_team", id }} canWrite={canManage && canUploadDocs} canDelete={canManage && canDeleteDocs} />
      </Section>
    </div>
  );
}
