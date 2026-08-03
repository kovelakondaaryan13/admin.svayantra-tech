/**
 * Thin, typed Qdrant REST client (config-gated by QDRANT_URL). Qdrant is the semantic
 * memory ONLY — never the source of truth. All operational state stays in MongoDB.
 */
import crypto from "node:crypto";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { KNOWLEDGE_COLLECTION, type ChunkPayload } from "@/lib/qdrant/collections";

const log = logger("qdrant");

export interface QdrantFilter {
  must?: unknown[];
  should?: unknown[];
}

export interface SearchHit {
  id: string;
  score: number;
  payload: ChunkPayload;
}

/** Deterministic UUID point id from (documentId, chunkIndex) so re-ingest is idempotent. */
export function pointId(documentId: string, chunkIndex: number): string {
  const h = crypto.createHash("sha256").update(`${documentId}:${chunkIndex}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export function isQdrantConfigured(): boolean {
  return Boolean(env.QDRANT_URL());
}

async function req<T>(path: string, method: string, body?: unknown): Promise<T> {
  const base = env.QDRANT_URL();
  if (!base) throw new Error("QDRANT_URL not configured");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const apiKey = env.QDRANT_API_KEY();
  if (apiKey) headers["api-key"] = apiKey;
  const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Qdrant ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export const qdrant = {
  isConfigured: isQdrantConfigured,

  async health(): Promise<boolean> {
    if (!isQdrantConfigured()) return false;
    try {
      await req("/collections", "GET");
      return true;
    } catch (err) {
      log.warn("qdrant health failed", { error: String(err) });
      return false;
    }
  },

  /** Create the collection + payload indexes if missing. Idempotent. */
  async ensureCollection(dimension: number): Promise<void> {
    const exists = await req<{ result?: unknown }>(
      `/collections/${KNOWLEDGE_COLLECTION}/exists`,
      "GET",
    ).then((r) => Boolean((r.result as { exists?: boolean })?.exists)).catch(() => false);

    if (!exists) {
      await req(`/collections/${KNOWLEDGE_COLLECTION}`, "PUT", {
        vectors: { size: dimension, distance: "Cosine" },
      });
      log.info("created knowledge collection", { dimension });
    }

    // Field indexes enable efficient RBAC/tenant/workspace filtering. Creating an index that
    // already exists is a no-op, so this is safe to run on every ensure (covers collections
    // created before a new filter key like `workspace` was introduced).
    for (const field of ["orgId", "workspace", "documentId", "documentType", "permissions"]) {
      await req(`/collections/${KNOWLEDGE_COLLECTION}/index`, "PUT", {
        field_name: field,
        field_schema: "keyword",
      }).catch(() => undefined);
    }
  },

  async upsert(points: { id: string; vector: number[]; payload: ChunkPayload }[]): Promise<void> {
    if (points.length === 0) return;
    await req(`/collections/${KNOWLEDGE_COLLECTION}/points?wait=true`, "PUT", { points });
  },

  async search(vector: number[], limit: number, filter: QdrantFilter): Promise<SearchHit[]> {
    const json = await req<{ result: { id: string; score: number; payload: ChunkPayload }[] }>(
      `/collections/${KNOWLEDGE_COLLECTION}/points/search`,
      "POST",
      { vector, limit, filter, with_payload: true },
    );
    return json.result.map((r) => ({ id: r.id, score: r.score, payload: r.payload }));
  },

  async deleteByDocument(documentId: string): Promise<void> {
    await req(`/collections/${KNOWLEDGE_COLLECTION}/points/delete?wait=true`, "POST", {
      filter: { must: [{ key: "documentId", match: { value: documentId } }] },
    });
  },

  async count(): Promise<number> {
    if (!isQdrantConfigured()) return 0;
    const json = await req<{ result: { count: number } }>(
      `/collections/${KNOWLEDGE_COLLECTION}/points/count`,
      "POST",
      { exact: true },
    ).catch(() => ({ result: { count: 0 } }));
    return json.result.count;
  },
};
