/**
 * One-time Owner bootstrap — creates/promotes the first Owner account from ENV VARS.
 * NO hardcoded credentials, nothing committed. Idempotent.
 *
 *   OWNER_EMAIL, OWNER_PASSWORD  (required)
 *   OWNER_NAME, ORG_NAME, ORG_ID (optional; default "Owner" / "Svayantra Tech" / "default")
 *
 * Run: npm run bootstrap-owner   (loads .env.local)
 */
import { auth } from "@/lib/auth";
import { db } from "@/lib/mongo";
import { orgService } from "@/services/org-service";
import { employeeService } from "@/services/employee-service";

async function main() {
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  const name = process.env.OWNER_NAME || "Owner";
  const orgName = process.env.ORG_NAME || "Svayantra Tech";
  const orgId = process.env.ORG_ID || "default";

  if (!email || !password) {
    console.error("Set OWNER_EMAIL and OWNER_PASSWORD in the environment.");
    process.exit(1);
  }

  const users = (await db()).collection<{ _id: unknown; id?: string; email: string }>("user");
  let existing = await users.findOne({ email });
  let userId: string;

  if (existing) {
    userId = existing.id ?? String(existing._id);
    console.log(`Owner auth user already exists (${email}).`);
  } else {
    const res = (await auth.api.signUpEmail({ body: { email, password, name } })) as {
      user?: { id?: string };
    };
    userId = res.user?.id ?? "";
    if (!userId) {
      existing = await users.findOne({ email });
      userId = existing?.id ?? String(existing?._id ?? "");
    }
    console.log(`Created owner auth user (${email}).`);
  }

  if (!userId) {
    console.error("Could not resolve the owner user id.");
    process.exit(1);
  }

  await orgService.ensureOrganization(orgId, orgName, userId);
  await employeeService.setRole(userId, "owner", { email, name, orgId });

  console.log(`✅ Owner bootstrapped: ${email} (user ${userId}) → org "${orgId}" with role "owner".`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
