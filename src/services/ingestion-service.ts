/**
 * Ingestion pipeline (async). Upload returns as soon as bytes are in GridFS; THIS runs afterward,
 * moving a file through: stored → extracting → extracted → embedding → ready (or failed). One
 * parser failure never loses the upload, and steps are retryable. Reuses documentService for the
 * chunk→embed→index→Knowledge-document step (workspace-tagged Qdrant), so RAG picks it up.
 */
import { repo } from "@/data/collection";
import { getFileBuffer } from "@/lib/storage/gridfs";
import { findExtractor } from "@/lib/files/extractors";
import { documentService } from "@/services/document-service";
import { record } from "@/lib/telemetry";
import type { UploadedFile, IngestStatus } from "@/lib/file-entities";
import type { User } from "@/lib/types";

export const uploadedFiles = repo<UploadedFile>("uploadedFiles", { workspaceScoped: true });

async function set(orgId: string, id: string, patch: Partial<UploadedFile>): Promise<void> {
  await uploadedFiles.update(orgId, id, patch as Partial<UploadedFile>);
}

export const ingestionService = {
  async process(user: User, id: string): Promise<void> {
    const meta = await uploadedFiles.findById(user.orgId, id);
    if (!meta) return;
    try {
      await set(user.orgId, id, { status: "extracting" as IngestStatus, lastProcessedAt: new Date() });

      const got = await getFileBuffer(meta.fileId);
      if (!got) {
        await set(user.orgId, id, { status: "failed", errorReason: "File bytes not found in storage" });
        return;
      }

      const extractor = findExtractor(meta.name, meta.mimeType);
      if (!extractor) {
        const ext = meta.name.split(".").pop() ?? "file";
        // No parser registered for this file type at all — a terminal state, not "ready with
        // nothing extracted" (which is indistinguishable from a legitimately empty file).
        await set(user.orgId, id, { status: "failed", errorReason: `Unsupported file type — .${ext} files are not supported yet` });
        record("ingestion", "failed", { name: meta.name, reason: "unsupported_type" });
        return;
      }
      const r = await extractor.extract(got.buffer);
      if (r.unavailable) {
        const ext = meta.name.split(".").pop() ?? "file";
        // Uploaded fine; the PARSER is genuinely missing. Distinct from an extraction error.
        await set(user.orgId, id, { status: "failed", errorReason: `Extraction unavailable — the parser for .${ext} files is not available on the server` });
        record("ingestion", "failed", { name: meta.name, reason: "extraction_unavailable" });
        return;
      }
      if (r.error) {
        // Uploaded + parser present, but extraction failed (corrupt/unexpected file).
        await set(user.orgId, id, { status: "failed", errorReason: `Extraction failed: ${r.error}` });
        record("ingestion", "failed", { name: meta.name, reason: "extraction_error" });
        return;
      }
      const text = r.text;

      await set(user.orgId, id, { status: "extracted", extractedText: text, extractedChars: text.length });

      // Nothing to embed (e.g. image with no OCR): stored + tracked, but not indexed.
      if (!text.trim()) {
        await set(user.orgId, id, { status: "ready", chunkCount: 0 });
        return;
      }

      await set(user.orgId, id, { status: "embedding" });
      const rel = meta.related?.[0];
      const doc = await documentService.upload(user, {
        title: meta.name,
        documentType: "upload",
        text,
        source: "upload",
        ...(rel?.type === "company" ? { companyId: rel.id } : {}),
        ...(rel?.type === "lead" ? { dealId: rel.id } : {}),
        ...(rel?.type === "person" ? { clientId: rel.id } : {}),
      });
      await set(user.orgId, id, { status: "ready", documentId: doc.id, chunkCount: doc.chunkCount });
      record("ingestion", "ready", { name: meta.name, chunks: doc.chunkCount });
    } catch (err) {
      await uploadedFiles.update(user.orgId, id, {
        status: "failed",
        errorReason: String((err as Error)?.message ?? err),
        retryCount: (meta.retryCount ?? 0) + 1,
      } as Partial<UploadedFile>);
      record("ingestion", "failed", { name: meta.name, reason: String((err as Error)?.message ?? err).slice(0, 120) });
    }
  },
};
