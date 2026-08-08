/**
 * Persistent Assistant conversations (ChatGPT/Claude-style). This is the foundation for every
 * future AI feature (memory, agents, long-running tasks, approvals), so the schema is designed
 * forward: attachments/citations exist now so file uploads (Sprint 3) need NO migration, and
 * messages are provider-agnostic (provider/model/tokens/latency). Content collections →
 * org- + workspace-scoped (demo/production isolated).
 */
import type { BaseDoc } from "@/lib/entities";

export type RelatedObjectType = "company" | "person" | "lead" | "meeting" | "document" | "conveyor_team";

export interface RelatedObject {
  type: RelatedObjectType;
  id: string;
  label?: string;
}

/** Keep only rows whose `related`-array field links to the given object — the shared
 *  filter behind "documents/conversations for this lead/company/person" views. */
export function filterByRelated<T>(
  rows: T[],
  relatedKey: (row: T) => RelatedObject[] | undefined,
  type: string,
  id: string,
): T[] {
  return rows.filter((row) => (relatedKey(row) ?? []).some((r) => r.type === type && r.id === id));
}

/** Reference to an uploaded asset — populated in Sprint 3 (GridFS). Present now for forward-compat. */
export interface AttachmentReference {
  fileId: string; // GridFS / storage id
  name: string;
  mimeType?: string;
  size?: number;
  documentId?: string; // link to the Knowledge document once ingested
}

export interface Citation {
  index: number;
  documentId: string;
  title?: string;
  snippet?: string;
}

export interface Conversation extends BaseDoc {
  userId: string; // owner
  title: string;
  summary?: string; // rolling recap — future AI context, not for display
  messageCount: number;
  lastMessageAt?: Date;
  pinned?: boolean;
  archived?: boolean;
  relatedObjects?: RelatedObject[];
}

export type MessageStatus = "complete" | "streaming" | "error";

export interface ChatMessage extends BaseDoc {
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  status?: MessageStatus;
  attachments?: AttachmentReference[]; // forward-compat (Sprint 3)
  citations?: Citation[];
  // Provider-agnostic AI metadata (never couple to one vendor).
  provider?: string;
  model?: string;
  tokens?: { input?: number; output?: number };
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}
