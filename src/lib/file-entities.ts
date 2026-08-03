/** Uploaded file metadata + ingestion status. Binary lives in GridFS; this row tracks the
 *  pipeline (stored → extracting → … → ready/failed), keeps the raw extracted text (so we never
 *  reparse), versions revisions, and links to the Knowledge document + related objects. */
import type { BaseDoc } from "@/lib/entities";
import type { RelatedObject } from "@/lib/chat-entities";

export type IngestStatus =
  | "uploading"
  | "stored"
  | "extracting"
  | "extracted"
  | "chunking"
  | "embedding"
  | "indexing"
  | "ready"
  | "failed";

export interface UploadedFile extends BaseDoc {
  fileId: string; // GridFS file id
  name: string;
  mimeType?: string;
  size: number;
  uploadedBy: string;
  status: IngestStatus;
  errorReason?: string;
  lastProcessedAt?: Date;
  retryCount?: number;
  extractedText?: string; // raw text, kept for reuse (no reparse)
  extractedChars?: number;
  chunkCount?: number;
  documentId?: string; // KnowledgeDocument once indexed
  version: number; // revisions of the same file name are versioned, never overwritten
  related?: RelatedObject[]; // object-aware linking (Sprint 4)
}
