/**
 * Binary storage on MongoDB GridFS (bucket "uploads"). One database, no extra service — right for
 * an MVP/internal deployment. The higher-level Knowledge model is storage-agnostic, so this can be
 * swapped for S3/R2 later without touching services above it.
 */
import { GridFSBucket, ObjectId } from "mongodb";
import { db } from "@/lib/mongo";

async function bucket(): Promise<GridFSBucket> {
  return new GridFSBucket(await db(), { bucketName: "uploads" });
}

export async function storeFile(
  buffer: Buffer,
  filename: string,
  opts: { contentType?: string; metadata?: Record<string, unknown> } = {},
): Promise<string> {
  const b = await bucket();
  return new Promise<string>((resolve, reject) => {
    const up = b.openUploadStream(filename, { contentType: opts.contentType, metadata: opts.metadata });
    up.on("error", reject);
    up.on("finish", () => resolve(up.id.toString()));
    up.end(buffer);
  });
}

export async function getFileBuffer(
  id: string,
): Promise<{ buffer: Buffer; filename: string; contentType?: string } | null> {
  if (!ObjectId.isValid(id)) return null;
  const b = await bucket();
  const files = await b.find({ _id: new ObjectId(id) }).toArray();
  if (!files.length) return null;
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    b.openDownloadStream(new ObjectId(id))
      .on("data", (c: Buffer) => chunks.push(c))
      .on("error", reject)
      .on("end", () => resolve());
  });
  return { buffer: Buffer.concat(chunks), filename: files[0].filename, contentType: files[0].contentType };
}

export async function deleteFile(id: string): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const b = await bucket();
  await b.delete(new ObjectId(id)).catch(() => undefined);
}
