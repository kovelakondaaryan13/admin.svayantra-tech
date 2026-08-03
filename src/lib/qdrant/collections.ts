/**
 * Qdrant uses ONE collection with payload partitioning (by orgId, documentType,
 * permissions) rather than a collection per document type — this scales far better
 * (no per-type index sprawl) and keeps cross-type semantic search a single query.
 */
export const KNOWLEDGE_COLLECTION = "revenueos_knowledge";

/** Payload stored alongside every vector — enough to filter (RBAC/tenant) and cite. */
export interface ChunkPayload {
  orgId: string; // tenant scope
  workspace: "demo" | "production"; // data-isolation workspace (see lib/workspace.ts)
  documentId: string; // back-reference to MongoDB `documents`
  documentType: string;
  chunkIndex: number;
  text: string; // the chunk text (for context injection + citation snippets)
  title: string;
  source: string;
  createdBy: string;
  createdAt: string;
  permissions: string[]; // roles allowed to retrieve; empty = all org roles
  companyId?: string;
  clientId?: string;
  dealId?: string;
}
