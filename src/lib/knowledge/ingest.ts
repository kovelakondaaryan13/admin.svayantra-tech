/**
 * Ingestion pipeline: text → chunk → embed → upsert to Qdrant. Every vector carries
 * a payload that traces back to its MongoDB document (documentId + chunkIndex).
 */
import { chunkText } from "@/lib/knowledge/chunk";
import { embeddingProvider } from "@/lib/embeddings";
import { qdrant, pointId } from "@/lib/qdrant/client";
import type { ChunkPayload } from "@/lib/qdrant/collections";
import type { KnowledgeDocument } from "@/lib/knowledge-entities";

export interface IngestResult {
  chunkCount: number;
}

export async function ingestDocument(
  doc: KnowledgeDocument,
  documentId: string,
  text: string,
): Promise<IngestResult> {
  const chunks = chunkText(text);
  if (chunks.length === 0) return { chunkCount: 0 };

  const provider = embeddingProvider();
  await qdrant.ensureCollection(provider.dimension);
  const vectors = await provider.embed(chunks, "document");
  const createdAt = new Date().toISOString();

  const points = chunks.map((chunk, i) => ({
    id: pointId(documentId, i),
    vector: vectors[i],
    payload: {
      orgId: doc.orgId,
      workspace: doc.workspace ?? "production",
      documentId,
      documentType: doc.documentType,
      chunkIndex: i,
      text: chunk,
      title: doc.title,
      source: doc.source,
      createdBy: doc.createdBy,
      createdAt,
      permissions: doc.permissions,
      companyId: doc.companyId,
      clientId: doc.clientId,
      dealId: doc.dealId,
    } satisfies ChunkPayload,
  }));

  await qdrant.upsert(points);
  return { chunkCount: chunks.length };
}
