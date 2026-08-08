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
import { getUploadRetentionDays } from "@/lib/upload-retention";
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

  /** Delete failed uploads older than the org's configured retention window (default 7
   *  days) — a parser failure shouldn't sit in Knowledge forever with no path forward. */
  async sweepFailed(user: User): Promise<{ swept: number; retentionDays: number }> {
    const retentionDays = await getUploadRetentionDays(user.orgId);
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
    const rows = await uploadedFiles.list(user.orgId, { status: "failed" } as never, 500);
    const stale = rows.filter((r) => new Date(r.lastProcessedAt ?? r.updatedAt).getTime() < cutoff.getTime());
    const BATCH = 20;
    for (let i = 0; i < stale.length; i += BATCH) {
      await Promise.all(
        stale.slice(i, i + BATCH).map(async (r) => {
          await deleteFile(r.fileId).catch(() => undefined);
          await uploadedFiles.softDelete(user.orgId, r._id.toHexString());
        }),
      );
    }
    record("upload", "swept", { count: stale.length, retentionDays });
    return { swept: stale.length, retentionDays };
  },
};
