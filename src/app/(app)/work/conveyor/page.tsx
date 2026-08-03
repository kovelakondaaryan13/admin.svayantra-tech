import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/iam";
import { conveyorMetricsService } from "@/services/conveyor-metrics-service";
import { WorkTabs } from "@/components/work/work-tabs";
import { ConveyorDashboard } from "@/components/work/conveyor-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ConveyorPage() {
  const user = await requireUser();
  // Cross-team throughput is a management view.
  if (!can(user, "users.read")) redirect("/work/tasks");

  const metrics = await conveyorMetricsService.summary(user);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Work</h1>
        <p className="mt-1 text-sm text-muted">
          Conveyor throughput — how leads move through your specialized teams, where they stall,
          and how fast they close.
        </p>
      </header>
      <WorkTabs showConveyor />
      <ConveyorDashboard metrics={metrics} />
    </div>
  );
}
