/**
 * Provision the RC-1 dogfooding sales-rep accounts (Gaurav, Varshik, Mohan, Trilok, Suraj)
 * and align Deblina's title with her actual role. Idempotent. Every rep reports directly
 * to the owner (Aryan). Run: npm run add-sales-reps
 */
import { auth } from "@/lib/auth";
import { db } from "@/lib/mongo";
import { orgService } from "@/services/org-service";
import { employeeService } from "@/services/employee-service";

const ORG = "default";
const OWNER_EMAIL = "owner@svayantra.tech";

async function ensureAccount(email: string, name: string, password: string): Promise<string> {
  const users = (await db()).collection<{ _id: unknown; id?: string; email: string }>("user");
  let existing = await users.findOne({ email });
  let userId: string;
  if (existing) {
    userId = existing.id ?? String(existing._id);
    console.log(`account already exists: ${email}`);
  } else {
    const res = (await auth.api.signUpEmail({ body: { email, password, name } })) as {
      user?: { id?: string };
    };
    userId = res.user?.id ?? "";
    if (!userId) {
      existing = await users.findOne({ email });
      userId = existing?.id ?? String(existing?._id ?? "");
    }
    console.log(`created account ${email}`);
  }
  await orgService.ensureOrganization(ORG, "Svayantra Tech", userId);
  await employeeService.setRole(userId, "sales_rep", { email, name, orgId: ORG });
  return userId;
}

async function main() {
  const emps = (await db()).collection("employees");
  const owner = (await emps.findOne({ email: OWNER_EMAIL, orgId: ORG })) as { userId: string } | null;
  if (!owner) throw new Error(`owner account (${OWNER_EMAIL}) missing — cannot set reporting line`);
  const ownerId = owner.userId;

  const reps: Array<{ name: string; email: string; password: string }> = [
    { name: "Gaurav", email: "gaurav@svayantra.tech", password: "Gaurav@1234" },
    { name: "Varshik", email: "varshik@svayantra.tech", password: "Varshik@1234" },
    { name: "Mohan", email: "mohan@svayantra.tech", password: "Mohan@1234" },
    { name: "Trilok", email: "trilok@svayantra.tech", password: "Trilok@1234" },
    { name: "Suraj", email: "suraj@svayantra.tech", password: "Suraj@1234" },
  ];

  for (const rep of reps) {
    await ensureAccount(rep.email, rep.name, rep.password);
    await emps.updateOne(
      { email: rep.email, orgId: ORG },
      {
        $set: {
          title: "Sales Representative",
          skills: ["outreach", "discovery"],
          capacity: 6,
          availability: "available",
          managerUserId: ownerId,
          updatedAt: new Date(),
        },
      },
    );
    console.log(`profiled ${rep.email} (Sales Representative, reports to owner)`);
  }

  // Deblina already exists — align title with her actual role (Sales Representative).
  const deblina = await emps.updateOne(
    { email: "deblina@svayantra.tech", orgId: ORG },
    { $set: { title: "Sales Representative", managerUserId: ownerId, updatedAt: new Date() } },
  );
  if (deblina.matchedCount) console.log("updated deblina@svayantra.tech -> Sales Representative, reports to owner");

  const total = await emps.countDocuments({ orgId: ORG, deletedAt: { $exists: false } });
  console.log(`\n✅ Sales reps provisioned. ${total} employees in org "${ORG}".`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
