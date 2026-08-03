/**
 * Generic records for any custom object. One collection, metadata-typed. Every
 * record gets CRUD, org scope, RBAC (generic `objects.*` + per-object role
 * visibility), audit, and — if the object is AI-searchable — a Qdrant vector so the
 * AI can answer over it. No per-object code.
 */
import { repo, toDTO } from "@/data/collection";
import * as audit from "@/lib/audit";
import { assertPermission, isOwner } from "@/lib/iam";
import { NotFound, Forbidden } from "@/lib/errors";
import { embeddingProvider } from "@/lib/embeddings";
import { qdrant, pointId } from "@/lib/qdrant/client";
import { objectDefinitionService } from "@/services/object-definition-service";
import type { CustomRecord, ObjectDefinition } from "@/lib/platform/entities";
import type { DTO } from "@/lib/entities";
import type { User } from "@/lib/types";

const records = repo<CustomRecord>("customRecords", { workspaceScoped: true });

function assertObjectAccess(user: User, def: ObjectDefinition): void {
  if (def.permissions.length && !isOwner(user) && !def.permissions.includes(user.role)) {
    throw new Forbidden(`no access to object '${def.key}'`);
  }
}

function recordText(def: ObjectDefinition, rec: CustomRecord): string {
  const body = def.fields.map((f) => `${f.label}: ${rec.data[f.key] ?? ""}`).join("\n");
  return `${rec.name}\n${body}`;
}

async function indexRecord(def: ObjectDefinition, rec: CustomRecord): Promise<void> {
  if (!def.aiSearchable || !qdrant.isConfigured()) return;
  const provider = embeddingProvider();
  await qdrant.ensureCollection(provider.dimension);
  const [vector] = await provider.embed([recordText(def, rec)], "document");
  await qdrant.upsert([
    {
      id: pointId(rec._id.toHexString(), 0),
      vector,
      payload: {
        orgId: rec.orgId,
        workspace: rec.workspace ?? "production",
        documentId: rec._id.toHexString(),
        documentType: `object:${def.key}`,
        chunkIndex: 0,
        text: recordText(def, rec),
        title: rec.name,
        source: "custom_object",
        createdBy: rec.createdBy,
        createdAt: new Date().toISOString(),
        permissions: def.permissions,
      },
    },
  ]);
}

export const recordService = {
  async list(user: User, objectKey: string): Promise<DTO<CustomRecord>[]> {
    assertPermission(user, "objects.read");
    const def = await objectDefinitionService.getByKey(user, objectKey);
    if (!def) throw new NotFound(`object '${objectKey}' not found`);
    assertObjectAccess(user, def);
    return (await records.list(user.orgId, { objectKey } as never)).map(toDTO);
  },

  async get(user: User, objectKey: string, id: string): Promise<DTO<CustomRecord>> {
    assertPermission(user, "objects.read");
    const def = await objectDefinitionService.getByKey(user, objectKey);
    if (!def) throw new NotFound(`object '${objectKey}' not found`);
    assertObjectAccess(user, def);
    const rec = await records.findById(user.orgId, id);
    if (!rec || rec.objectKey !== objectKey) throw new NotFound("record not found");
    return toDTO(rec);
  },

  async create(user: User, objectKey: string, data: Record<string, unknown>): Promise<DTO<CustomRecord>> {
    assertPermission(user, "objects.write");
    const def = await objectDefinitionService.getByKey(user, objectKey);
    if (!def) throw new NotFound(`object '${objectKey}' not found`);
    assertObjectAccess(user, def);
    const name = String(data[def.displayField] ?? "Untitled");
    const rec = await records.insert(user.orgId, { objectKey, name, data, createdBy: user.id });
    await indexRecord(def, rec);
    await audit.record({ actor: user, action: `object.${objectKey}.create`, entity: rec._id.toHexString() });
    return toDTO(rec);
  },

  async update(user: User, objectKey: string, id: string, data: Record<string, unknown>): Promise<DTO<CustomRecord>> {
    assertPermission(user, "objects.write");
    const def = await objectDefinitionService.getByKey(user, objectKey);
    if (!def) throw new NotFound(`object '${objectKey}' not found`);
    assertObjectAccess(user, def);
    const existing = await records.findById(user.orgId, id);
    if (!existing || existing.objectKey !== objectKey) throw new NotFound("record not found");
    const merged = { ...existing.data, ...data };
    const name = String(merged[def.displayField] ?? existing.name);
    const rec = await records.update(user.orgId, id, { data: merged, name });
    if (rec) await indexRecord(def, rec);
    await audit.record({ actor: user, action: `object.${objectKey}.update`, entity: id });
    return toDTO(rec!);
  },

  async remove(user: User, objectKey: string, id: string): Promise<void> {
    assertPermission(user, "objects.delete");
    const def = await objectDefinitionService.getByKey(user, objectKey);
    if (!def) throw new NotFound(`object '${objectKey}' not found`);
    assertObjectAccess(user, def);
    if (qdrant.isConfigured()) await qdrant.deleteByDocument(id).catch(() => undefined);
    if (!(await records.softDelete(user.orgId, id))) throw new NotFound("record not found");
    await audit.record({ actor: user, action: `object.${objectKey}.delete`, entity: id });
  },
};
