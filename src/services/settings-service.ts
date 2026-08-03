/** Org- and user-scoped settings (simple key/value document store). */
import { db } from "@/lib/mongo";
import type { User } from "@/lib/types";

type Scope = "org" | "user";

async function readSettings(orgId: string, scope: Scope, scopeId: string) {
  const database = await db();
  const doc = await database.collection("settings").findOne({ orgId, scope, scopeId });
  return (doc?.data as Record<string, unknown>) ?? {};
}

async function writeSettings(
  orgId: string,
  scope: Scope,
  scopeId: string,
  patch: Record<string, unknown>,
) {
  const database = await db();
  await database
    .collection("settings")
    .updateOne(
      { orgId, scope, scopeId },
      { $set: { orgId, scope, scopeId, [`data`]: patch, updatedAt: new Date() } },
      { upsert: true },
    );
  return patch;
}

export const settingsService = {
  getOrg: (user: User) => readSettings(user.orgId, "org", user.orgId),
  updateOrg: (user: User, patch: Record<string, unknown>) =>
    writeSettings(user.orgId, "org", user.orgId, patch),
  getUser: (user: User) => readSettings(user.orgId, "user", user.id),
  updateUser: (user: User, patch: Record<string, unknown>) =>
    writeSettings(user.orgId, "user", user.id, patch),
};
