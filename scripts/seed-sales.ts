/**
 * Seed default Operating Playbooks + a Conveyor Team. Idempotent (keyed).
 * Run: npm run seed-sales
 */
import { db } from "@/lib/mongo";
import { playbookService } from "@/services/playbook-service";
import { conveyorTeamService } from "@/services/conveyor-team-service";
import type { User } from "@/lib/types";

const ORG = "default";

async function main() {
  const d = await db();
  const emps = d.collection("employees");
  const owner = (await emps.findOne({ email: "ownertest1@svayantra.tech", orgId: ORG })) as { userId: string } | null;
  if (!owner) throw new Error("owner test account missing — run add-people first");
  const user: User = { id: owner.userId, email: "ownertest1@svayantra.tech", name: "Owner Test", role: "owner", orgId: ORG, permissions: ["*"], isOwner: true };

  const uid = async (email: string) => ((await emps.findOne({ email, orgId: ORG })) as { userId: string } | null)?.userId;

  // --- Playbooks (stage keys map to LeadStage so SLAs apply on advance) ---
  const existing = await playbookService.list(user);
  const have = new Set(existing.map((p) => p.key));

  if (!have.has("individual-full-cycle")) {
    await playbookService.create(user, {
      key: "individual-full-cycle",
      label: "Individual Full-Cycle",
      model: "individual",
      description: "One rep owns the whole journey from prospecting to close.",
      stages: [
        { key: "new", label: "Research & List", slaHours: 48, exitCriteria: "Contact identified" },
        { key: "qualified", label: "Qualification", slaHours: 48, exitCriteria: "ICP + budget confirmed" },
        { key: "meeting", label: "Meeting Booked", slaHours: 72 },
        { key: "proposal", label: "Proposal", slaHours: 72, artifacts: ["proposal"] },
        { key: "negotiation", label: "Negotiation", slaHours: 96 },
        { key: "won", label: "Won / Handover", artifacts: ["handover-note"] },
      ],
    });
    console.log("seeded playbook: individual-full-cycle");
  }

  if (!have.has("conveyor-outbound")) {
    await playbookService.create(user, {
      key: "conveyor-outbound",
      label: "Conveyor Outbound",
      model: "conveyor",
      description: "Specialists own each stage; leads hand off down the belt with SLAs.",
      stages: [
        { key: "new", label: "Lead Sourcing", ownerRole: "sales_rep", slaHours: 24, exitCriteria: "Verified contact + reason to reach out" },
        { key: "qualified", label: "Qualification", ownerRole: "sales_rep", slaHours: 24, exitCriteria: "Fit + intent confirmed" },
        { key: "meeting", label: "Meeting Booking", ownerRole: "sales_rep", slaHours: 48, exitCriteria: "Discovery scheduled" },
        { key: "proposal", label: "Proposal", ownerRole: "sales_head", slaHours: 72, artifacts: ["proposal"] },
        { key: "negotiation", label: "Closing", ownerRole: "sales_head", slaHours: 72 },
        { key: "won", label: "Client Handover", ownerRole: "ops_manager", artifacts: ["handover-checklist"] },
      ],
    });
    console.log("seeded playbook: conveyor-outbound");
  }

  // --- Conveyor Team: Outbound Team Alpha (Rahul, Priya, Deblina) ---
  const teams = await conveyorTeamService.list(user);
  if (!teams.some((t) => t.name === "Outbound Team Alpha")) {
    const members = (await Promise.all([
      uid("rahul.verma@svayantra.tech"),
      uid("priya.sharma@svayantra.tech"),
      uid("deblina@svayantra.tech"),
    ])).filter((x): x is string => Boolean(x));
    const team = await conveyorTeamService.create(user, {
      name: "Outbound Team Alpha",
      memberUserIds: members,
      playbookKey: "conveyor-outbound",
    });
    console.log(`seeded conveyor team: Outbound Team Alpha (${members.length} members) id=${team.id}`);
  }

  console.log("\n✅ Sales models seeded.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
