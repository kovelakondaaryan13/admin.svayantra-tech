/**
 * Better Auth configuration + session guards. Uses the SHARED singleton Mongo
 * client from `@/lib/database` — there is exactly one MongoClient in the app.
 * DNS is configured inside the shared client (co-located with connect) and at boot
 * (instrumentation), so Better Auth's lazy connect resolves SRV correctly.
 * Guide: .claude/skills/security/implement-authentication.md
 *
 * NOTE: Better Auth's exact surface can shift between minor versions. If a symbol
 * below doesn't resolve against the installed version, check the Better Auth docs —
 * the shape (betterAuth() + mongodbAdapter + getSession) is stable.
 */
import { cache } from "react";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { headers as nextHeaders } from "next/headers";
import { getClientSync } from "@/lib/database";
import { env } from "@/lib/env";
import { Unauthorized } from "@/lib/errors";
import { resolveEffectivePermissions } from "@/lib/iam";
import { employeeService } from "@/services/employee-service";
import type { User } from "@/lib/types";

export const auth = betterAuth({
  // Shared singleton client — NOT a second MongoClient.
  database: mongodbAdapter(getClientSync().db(env.MONGODB_DB())),
  secret: env.BETTER_AUTH_SECRET(),
  baseURL: env.BETTER_AUTH_URL(),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "sales_rep", required: false },
      orgId: { type: "string", required: false },
    },
  },
});

/** Returns the current User (with resolved permissions) or null. Memoized per request. */
export const getUser = cache(async (): Promise<User | null> => {
  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session?.user) return null;
  const u = session.user as unknown as {
    id: string;
    email: string;
    name?: string;
    orgId?: string;
  };
  // Role/org/department come from the employee directory (the authorization source
  // of truth), NOT from Better Auth (which only authenticates).
  const membership = await employeeService.getOrCreateMembership(u.id, {
    email: u.email,
    name: u.name,
    orgId: u.orgId ?? "default",
  });
  const permissions = await resolveEffectivePermissions(membership.orgId, u.id, membership.role);
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: membership.role,
    orgId: membership.orgId,
    permissions,
    isOwner: membership.role === "owner" || permissions.includes("*"),
    departmentId: membership.departmentId,
    teamId: membership.teamId,
    managerUserId: membership.managerUserId,
  };
});

/** Returns the current User or throws Unauthorized (401). */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) throw new Unauthorized();
  return user;
}
