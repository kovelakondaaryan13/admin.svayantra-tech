/**
 * Owner-configurable retention window for failed uploads (default 7 days) — stored under
 * its own dot-path key in the org settings document, mirroring `lib/mode.ts`. Deliberately
 * NOT routed through `settingsService.updateOrg`, which replaces the whole `data` blob on
 * write rather than merging; a dedicated dot-path `$set` here can't clobber unrelated
 * settings the way a full-object PATCH could.
 */
import { db } from "@/lib/mongo";

export const DEFAULT_UPLOAD_RETENTION_DAYS = 7;

export async function getUploadRetentionDays(orgId: string): Promise<number> {
  const database = await db();
  const doc = await database.collection("settings").findOne({ orgId, scope: "org", scopeId: orgId });
  const data = (doc?.data as Record<string, unknown> | undefined) ?? {};
  const n = data.uploadRetentionDays;
  return typeof n === "number" && n > 0 ? n : DEFAULT_UPLOAD_RETENTION_DAYS;
}

export async function setUploadRetentionDays(orgId: string, days: number): Promise<void> {
  const database = await db();
  await database.collection("settings").updateOne(
    { orgId, scope: "org", scopeId: orgId },
    { $set: { orgId, scope: "org", scopeId: orgId, "data.uploadRetentionDays": days, updatedAt: new Date() } },
    { upsert: true },
  );
}
