/**
 * Operating mode — Demo vs Production.
 *
 *  - "demo":       synthetic simulation data is allowed; the simulation/reset scripts and the
 *                  in-app "Reset demo data" action are enabled. Safe for evaluation.
 *  - "production":  real users and real data only; destructive/synthetic seeding is refused.
 *
 * Stored in the org settings document (scope "org"). Defaults to "demo" until an owner
 * flips it, so a fresh install is safe to explore. Read this before doing anything that
 * creates or wipes synthetic entities.
 */
import { db } from "@/lib/mongo";

export type OperatingMode = "demo" | "production";
export const DEFAULT_MODE: OperatingMode = "demo";

export async function getOrgMode(orgId: string): Promise<OperatingMode> {
  const database = await db();
  const doc = await database.collection("settings").findOne({ orgId, scope: "org", scopeId: orgId });
  const data = (doc?.data as Record<string, unknown> | undefined) ?? {};
  return data.mode === "production" ? "production" : DEFAULT_MODE;
}

export async function setOrgMode(orgId: string, mode: OperatingMode): Promise<void> {
  const database = await db();
  await database.collection("settings").updateOne(
    { orgId, scope: "org", scopeId: orgId },
    { $set: { orgId, scope: "org", scopeId: orgId, "data.mode": mode, updatedAt: new Date() } },
    { upsert: true },
  );
}

export async function assertDemoMode(orgId: string): Promise<void> {
  if ((await getOrgMode(orgId)) === "production") {
    throw new Error(
      "STOS is in Production mode — synthetic/demo data operations are disabled. " +
        "Switch to Demo mode in Workspace › Settings to run simulations.",
    );
  }
}
