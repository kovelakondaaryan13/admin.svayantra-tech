/**
 * Authoritative index definitions, applied idempotently on deploy.
 * Documented in .claude/knowledge/database/README.md.
 */
import { db } from "@/lib/mongo";

export async function ensureIndexes(): Promise<void> {
  const database = await db();

  await database.collection("leads").createIndexes([
    { key: { orgId: 1, stage: 1, updatedAt: -1 }, name: "org_stage_updated" },
    { key: { orgId: 1, ownerId: 1 }, name: "org_owner" },
    { key: { orgId: 1, deletedAt: 1 }, name: "org_deleted" },
  ]);

  await database
    .collection("companies")
    .createIndexes([{ key: { orgId: 1, updatedAt: -1 }, name: "org_updated" }]);

  await database
    .collection("contacts")
    .createIndexes([
      { key: { orgId: 1, updatedAt: -1 }, name: "org_updated" },
      { key: { orgId: 1, companyId: 1 }, name: "org_company" },
    ]);

  await database
    .collection("tasks")
    .createIndexes([
      { key: { orgId: 1, assigneeId: 1, status: 1 }, name: "org_assignee_status" },
      { key: { orgId: 1, leadId: 1 }, name: "org_lead" },
    ]);

  await database
    .collection("meetings")
    .createIndexes([{ key: { orgId: 1, at: -1 }, name: "org_at" }]);

  await database
    .collection("activities")
    .createIndexes([
      { key: { orgId: 1, entityType: 1, entityId: 1, createdAt: -1 }, name: "org_entity" },
      { key: { orgId: 1, createdAt: -1 }, name: "org_created" },
    ]);

  await database
    .collection("notifications")
    .createIndexes([{ key: { orgId: 1, userId: 1, read: 1 }, name: "org_user_read" }]);

  await database
    .collection("proposals")
    .createIndexes([{ key: { orgId: 1, leadId: 1, updatedAt: -1 }, name: "org_lead_updated" }]);

  await database
    .collection("quotations")
    .createIndexes([{ key: { orgId: 1, leadId: 1, updatedAt: -1 }, name: "org_lead_updated" }]);

  await database
    .collection("settings")
    .createIndexes([{ key: { orgId: 1, scope: 1, scopeId: 1 }, name: "org_scope", unique: true }]);

  await database
    .collection("documents")
    .createIndexes([
      { key: { orgId: 1, updatedAt: -1 }, name: "org_updated" },
      { key: { orgId: 1, documentType: 1 }, name: "org_type" },
      { key: { orgId: 1, companyId: 1 }, name: "org_company" },
    ]);

  await database
    .collection("connectorCredentials")
    .createIndexes([{ key: { orgId: 1, userId: 1, kind: 1 }, name: "org_user_kind" }]);

  // --- Identity & access (IAM / org structure) ---
  await database
    .collection("organizations")
    .createIndexes([{ key: { slug: 1 }, name: "slug", unique: true }]);
  await database
    .collection("departments")
    .createIndexes([{ key: { orgId: 1 }, name: "org" }]);
  await database
    .collection("teams")
    .createIndexes([{ key: { orgId: 1, departmentId: 1 }, name: "org_dept" }]);
  await database
    .collection("employees")
    .createIndexes([
      { key: { userId: 1 }, name: "user", unique: true },
      { key: { orgId: 1, roleKey: 1 }, name: "org_role" },
    ]);
  await database
    .collection("roles")
    .createIndexes([{ key: { orgId: 1, key: 1 }, name: "org_key", unique: true }]);
  await database
    .collection("userPermissions")
    .createIndexes([{ key: { orgId: 1, userId: 1 }, name: "org_user", unique: true }]);

  // --- Configurable platform (metadata-driven) ---
  await database
    .collection("orgUnits")
    .createIndexes([{ key: { orgId: 1, parentId: 1 }, name: "org_parent" }]);
  await database
    .collection("objectDefinitions")
    .createIndexes([{ key: { orgId: 1, key: 1 }, name: "org_key", unique: true }]);
  await database
    .collection("customRecords")
    .createIndexes([{ key: { orgId: 1, objectKey: 1, updatedAt: -1 }, name: "org_object_updated" }]);
  await database
    .collection("workflowDefinitions")
    .createIndexes([{ key: { orgId: 1, key: 1 }, name: "org_key", unique: true }]);
  await database
    .collection("workflowInstances")
    .createIndexes([{ key: { orgId: 1, status: 1, updatedAt: -1 }, name: "org_status" }]);
  await database
    .collection("policies")
    .createIndexes([
      { key: { orgId: 1, key: 1 }, name: "org_key", unique: true },
      { key: { orgId: 1, domain: 1 }, name: "org_domain" },
    ]);

  await database
    .collection("auditLogs")
    .createIndexes([{ key: { orgId: 1, at: -1 }, name: "org_at" }]);
}
