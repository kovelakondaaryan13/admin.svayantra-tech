/**
 * Data-isolation workspace. STOS keeps two completely separate datasets in the same org:
 *
 *   - "demo":        synthetic simulation data (the sandbox for demos / evaluation).
 *   - "production":  genuine business data only.
 *
 * The active workspace maps 1:1 to the org operating mode (src/lib/mode.ts): Demo mode →
 * demo workspace, Production mode → production workspace. CONTENT collections (leads, tasks,
 * meetings, proposals, activities, documents, …) are tagged with the workspace on write and
 * filtered by the active workspace on read, so the two datasets never appear together and
 * demo can never write into production. Identity/config (users, roles, employees, org units,
 * playbooks) is intentionally shared so authentication and structure survive a mode switch.
 *
 * Resolved once per request (React cache) so the extra settings read is paid at most once.
 */
import { cache } from "react";
import { getOrgMode } from "@/lib/mode";

export type Workspace = "demo" | "production";

const ORG = "default"; // single-tenant today; thread orgId here when multi-tenant

export const activeWorkspace = cache(async (): Promise<Workspace> => {
  return (await getOrgMode(ORG)) === "production" ? "production" : "demo";
});
