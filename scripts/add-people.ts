/**
 * Seed realistic employees + operational fields for the Work Execution Engine.
 * Idempotent. Adds Deblina (Marketing) as a real login and sets title/skills/
 * capacity/availability + reporting lines on the existing team.
 * NEVER touches the protected real owner (aryangoud0913). Run: npm run add-people
 */
import { auth } from "@/lib/auth";
import { db } from "@/lib/mongo";
import { orgService } from "@/services/org-service";
import { employeeService } from "@/services/employee-service";

const ORG = "default";
const PASSWORD = "PASSWORD@1234";

async function ensureAccount(email: string, name: string, roleKey: string): Promise<string> {
  const users = (await db()).collection<{ _id: unknown; id?: string; email: string }>("user");
  let existing = await users.findOne({ email });
  let userId: string;
  if (existing) {
    userId = existing.id ?? String(existing._id);
  } else {
    const res = (await auth.api.signUpEmail({ body: { email, password: PASSWORD, name } })) as {
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
  await employeeService.setRole(userId, roleKey, { email, name, orgId: ORG });
  return userId;
}

async function main() {
  const emps = (await db()).collection("employees");
  const byEmail = async (email: string) => (await emps.findOne({ email, orgId: ORG })) as { userId: string } | null;

  // Deblina — new Marketing & Brand hire (real login).
  await ensureAccount("deblina@svayantra.tech", "Deblina", "marketing");

  const owner = await byEmail("ownertest1@svayantra.tech");
  const rahul = await byEmail("rahul.verma@svayantra.tech");
  const ownerId = owner?.userId;
  const rahulId = rahul?.userId;

  // email -> operational profile (+ reporting line)
  const profiles: Record<string, { title: string; skills: string[]; capacity: number; manager?: string }> = {
    "rahul.verma@svayantra.tech": { title: "Head of Sales", skills: ["closing", "negotiation", "coaching"], capacity: 8, manager: ownerId },
    "priya.sharma@svayantra.tech": { title: "Sales Representative", skills: ["outreach", "discovery", "linkedin"], capacity: 6, manager: rahulId },
    "kb@svayantra.tech": { title: "Sales Representative", skills: ["outreach", "email"], capacity: 6, manager: rahulId },
    "anita.desai@svayantra.tech": { title: "Head of Finance", skills: ["invoicing", "collections", "margins"], capacity: 6, manager: ownerId },
    "vikram.rao@svayantra.tech": { title: "Operations Manager", skills: ["delivery", "provisioning", "QA"], capacity: 8, manager: ownerId },
    "deblina@svayantra.tech": { title: "Marketing & Brand", skills: ["content", "brand", "campaigns"], capacity: 6, manager: ownerId },
  };

  for (const [email, p] of Object.entries(profiles)) {
    const res = await emps.updateOne(
      { email, orgId: ORG },
      {
        $set: {
          title: p.title,
          skills: p.skills,
          capacity: p.capacity,
          availability: "available",
          ...(p.manager ? { managerUserId: p.manager } : {}),
          updatedAt: new Date(),
        },
      },
    );
    if (res.matchedCount) console.log(`profiled ${email} (${p.title})`);
  }

  const total = await emps.countDocuments({ orgId: ORG, deletedAt: { $exists: false } });
  console.log(`\n✅ People seeded. ${total} employees in org "${ORG}".`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
