/**
 * Documents = MongoDB metadata (source of truth) + Qdrant vectors (semantic memory).
 * Upload → validate → persist metadata (pending) → ingest (chunk/embed/upsert) →
 * mark embedded. Delete removes vectors AND soft-deletes metadata.
 */
import { repo, toDTO } from "@/data/collection";
import * as audit from "@/lib/audit";
import { activityService } from "@/services/activity-service";
import { ingestDocument } from "@/lib/knowledge/ingest";
import { qdrant } from "@/lib/qdrant/client";
import { NotFound, BusinessRule } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { KnowledgeDocument, DocumentType } from "@/lib/knowledge-entities";
import type { DTO } from "@/lib/entities";
import type { User } from "@/lib/types";

const docs = repo<KnowledgeDocument>("documents", { workspaceScoped: true });
const log = logger("documents");
const MAX_BYTES = 10 * 1024 * 1024; // 10MB of text

export interface UploadInput {
  title: string;
  documentType: DocumentType;
  text: string; // extracted/plain text
  mimeType?: string;
  source?: string;
  companyId?: string;
  clientId?: string;
  dealId?: string;
  permissions?: string[];
}

export const documentService = {
  async upload(user: User, input: UploadInput): Promise<DTO<KnowledgeDocument>> {
    const text = (input.text ?? "").trim();
    if (!text) throw new BusinessRule("document has no text content");
    const sizeBytes = Buffer.byteLength(text, "utf8");
    if (sizeBytes > MAX_BYTES) throw new BusinessRule("document exceeds 10MB text limit");

    const doc = await docs.insert(user.orgId, {
      title: input.title,
      documentType: input.documentType,
      source: input.source ?? "upload",
      version: 1,
      createdBy: user.id,
      companyId: input.companyId,
      clientId: input.clientId,
      dealId: input.dealId,
      mimeType: input.mimeType ?? "text/plain",
      sizeBytes,
      status: "pending",
      chunkCount: 0,
      permissions: input.permissions ?? [],
    });
    const documentId = doc._id.toHexString();
    await activityService.log(user, "document", documentId, "added", `Document "${input.title}" added to Knowledge`);

    // Vector store not configured yet: keep the metadata (source of truth) as
    // `pending`; it can be embedded later once QDRANT_URL is set (re-index job).
    if (!qdrant.isConfigured()) {
      await audit.record({ actor: user, action: "document.upload", entity: documentId, meta: { pending: true } });
      log.warn("QDRANT_URL not set — document stored as pending (not embedded)", { documentId });
      return toDTO(doc);
    }

    try {
      const { chunkCount } = await ingestDocument(doc, documentId, text);
      const updated = await docs.update(user.orgId, documentId, {
        status: "embedded",
        chunkCount,
      });
      await audit.record({ actor: user, action: "document.upload", entity: documentId, meta: { chunkCount } });
      log.info("document ingested", { documentId, chunkCount });
      return toDTO(updated!);
    } catch (err) {
      await docs.update(user.orgId, documentId, { status: "failed", error: String(err) });
      log.error("document ingestion failed", { documentId, error: String(err) });
      throw err;
    }
  },

  async list(user: User): Promise<DTO<KnowledgeDocument>[]> {
    return (await docs.list(user.orgId)).map(toDTO);
  },

  async get(user: User, id: string): Promise<DTO<KnowledgeDocument>> {
    const doc = await docs.findById(user.orgId, id);
    if (!doc) throw new NotFound("document not found");
    return toDTO(doc);
  },

  async remove(user: User, id: string): Promise<void> {
    const doc = await docs.findById(user.orgId, id);
    if (!doc) throw new NotFound("document not found");
    if (qdrant.isConfigured()) await qdrant.deleteByDocument(id).catch(() => undefined);
    await docs.softDelete(user.orgId, id);
    await audit.record({ actor: user, action: "document.delete", entity: id });
  },
};
