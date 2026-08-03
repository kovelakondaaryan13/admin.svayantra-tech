/**
 * Upload service — stores bytes in GridFS + creates the metadata row, then kicks off the async
 * ingestion pipeline (does NOT wait for extraction/embedding). Files are versioned by name
 * (revisions never overwrite history). All persistence goes through here.
 */
import { toDTO } from "@/data/collection";
import { storeFile, getFileBuffer, deleteFile } from "@/lib/storage/gridfs";
import { uploadedFiles, ingestionService } from "@/services/ingestion-service";
import { record } from "@/lib/telemetry";
import { NotFound } from "@/lib/errors";
import { filterByRelated, type RelatedObject } from "@/lib/chat-entities";
import type { UploadedFile } from "@/lib/file-entities";
import type { DTO } from "@/lib/entities";
import type { User } from "@/lib/types";

export interface UploadInput {
  buffer: Buffer;
  name: string;
  mimeType?: string;
  related?: RelatedObject[];
}

export const uploadService = {
  /** Store bytes + create the record; ingestion runs asynchronously. Returns immediately. */
  async upload(user: User, input: UploadInput): Promise<DTO<UploadedFile>> {
    const prior = await uploadedFiles.list(user.orgId, { name: input.name } as never, 100);
    const version = prior.length + 1;
    const fileId = await storeFile(input.buffer, input.name, {
      contentType: input.mimeType,
      metadata: { orgId: user.orgId, userId: user.id, name: input.name },
    });
    const doc = await uploadedFiles.insert(user.orgId, {
      fileId,
      name: input.name,
      mimeType: input.mimeType,
      size: input.buffer.length,
      uploadedBy: user.id,
      status: "stored",
      version,
      related: input.related,
    });
    record("upload", "received", { name: input.name, size: input.buffer.length });
    // Fire-and-forget: the upload response does not wait for extraction/embedding.
    void ingestionService.process(user, doc._id.toHexString()).catch(() => undefined);
    return toDTO(doc);
  },

  /** All uploads, or only those linked to a given object (relatedType + relatedId). */
  async list(user: User, opts: { relatedType?: string; relatedId?: string } = {}): Promise<DTO<UploadedFile>[]> {
    const rows = await uploadedFiles.list(user.orgId, {}, 200);
    const filtered = opts.relatedType && opts.relatedId
      ? filterByRelated(rows, (r) => r.related, opts.relatedType, opts.relatedId)
      : rows;
    return filtered.map(toDTO);
  },

  async getFileById(user: User, recordId: string): Promise<{ buffer: Buffer; filename: string; contentType?: string }> {
    const meta = await uploadedFiles.findById(user.orgId, recordId);
    if (!meta) throw new NotFound("file not found");
    const got = await getFileBuffer(meta.fileId);
    if (!got) throw new NotFound("file bytes not found");
    return got;
  },

  async reprocess(user: User, recordId: string): Promise<DTO<UploadedFile>> {
    const meta = await uploadedFiles.findById(user.orgId, recordId);
    if (!meta) throw new NotFound("file not found");
    await ingestionService.process(user, recordId);
    const updated = await uploadedFiles.findById(user.orgId, recordId);
    return toDTO(updated!);
  },

  async remove(user: User, recordId: string): Promise<void> {
    const meta = await uploadedFiles.findById(user.orgId, recordId);
    if (!meta) throw new NotFound("file not found");
    await deleteFile(meta.fileId);
    await uploadedFiles.softDelete(user.orgId, recordId);
  },
};
