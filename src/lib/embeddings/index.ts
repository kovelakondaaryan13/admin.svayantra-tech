/**
 * Embedding provider factory. Uses Voyage when configured; otherwise a deterministic
 * DEV-ONLY fallback so the ingestion/retrieval pipeline is runnable and testable
 * without a paid key. The fallback is NOT semantic — production requires VOYAGE_API_KEY.
 */
import crypto from "node:crypto";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { EmbeddingProvider } from "@/lib/embeddings/types";
import { VoyageEmbeddingProvider } from "@/lib/embeddings/voyage";

const log = logger("embeddings");

/** Deterministic hashed embedding — dev/test only, keeps the pipeline exercisable. */
class DevHashEmbeddingProvider implements EmbeddingProvider {
  readonly model = "dev-hash";
  readonly dimension = env.EMBEDDING_DIM();
  isConfigured(): boolean {
    return true;
  }
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => {
      const vec = new Array<number>(this.dimension).fill(0);
      for (const token of t.toLowerCase().split(/\W+/).filter(Boolean)) {
        const h = crypto.createHash("sha256").update(token).digest();
        const idx = h.readUInt32BE(0) % this.dimension;
        vec[idx] += 1;
      }
      const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
      return vec.map((v) => v / norm);
    });
  }
}

let cached: EmbeddingProvider | null = null;

export function embeddingProvider(): EmbeddingProvider {
  if (cached) return cached;
  const voyage = new VoyageEmbeddingProvider();
  if (voyage.isConfigured()) {
    cached = voyage;
  } else {
    log.warn("VOYAGE_API_KEY not set — using DEV hashed embeddings (non-semantic)");
    cached = new DevHashEmbeddingProvider();
  }
  return cached;
}

export type { EmbeddingProvider };
