/**
 * Entities for the knowledge engine + connectors. Operational metadata lives in
 * MongoDB (source of truth); embeddings/chunks live in Qdrant (semantic memory).
 * A Document row NEVER stores chunk vectors — only metadata + a pointer count.
 */
import type { BaseDoc } from "@/lib/entities";
import type { SealedSecret } from "@/lib/crypto/encryption";

export type DocumentType =
  | "proposal"
  | "quotation"
  | "meeting_transcript"
  | "contract"
  | "email"
  | "note"
  | "sop"
  | "upload";

export type DocumentStatus = "pending" | "embedded" | "failed";

export interface KnowledgeDocument extends BaseDoc {
  title: string;
  documentType: DocumentType;
  source: string; // e.g. "upload", "google_drive", "manual"
  version: number;
  createdBy: string; // user id
  // Optional relationships back into the CRM (all MongoDB ids).
  companyId?: string;
  clientId?: string;
  dealId?: string;
  // File facts.
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  chunkCount: number;
  // RBAC: roles allowed to retrieve this document via AI. Empty = all org roles.
  permissions: string[];
  error?: string;
}

export type ConnectorKind =
  | "google_calendar"
  | "google_drive"
  | "gmail"
  | "slack"
  | "notion"
  | "whatsapp"
  | "outlook"
  | "confluence"
  | "dropbox"
  | "sharepoint";

export type ConnectorStatus = "connected" | "disconnected" | "error";

export interface ConnectorCredential extends BaseDoc {
  kind: ConnectorKind;
  userId: string; // owner of the connection
  accountEmail?: string;
  scopes: string[];
  status: ConnectorStatus;
  secret: SealedSecret; // encrypted OAuth refresh token bundle
  expiresAt?: Date; // access-token expiry (refresh handled on demand)
  lastSyncedAt?: Date;
  error?: string;
}
