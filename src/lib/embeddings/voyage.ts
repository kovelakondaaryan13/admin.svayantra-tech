/**
 * Voyage AI embeddings (Anthropic's recommended embedding provider) via REST.
 * Config-gated by VOYAGE_API_KEY.
 */
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { EmbeddingProvider } from "@/lib/embeddings/types";

const log = logger("embeddings:voyage");

export class VoyageEmbeddingProvider implements EmbeddingProvider {
  readonly model = env.EMBEDDING_MODEL();
  readonly dimension = env.EMBEDDING_DIM();

  isConfigured(): boolean {
    return Boolean(env.VOYAGE_API_KEY());
  }

  async embed(texts: string[], inputType: "document" | "query"): Promise<number[][]> {
    if (texts.length === 0) return [];
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.VOYAGE_API_KEY()}`,
      },
      body: JSON.stringify({ input: texts, model: this.model, input_type: inputType }),
    });
    if (!res.ok) {
      const body = await res.text();
      log.error("voyage embed failed", { status: res.status, body: body.slice(0, 300) });
      throw new Error(`Voyage embeddings failed: ${res.status}`);
    }
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data.map((d) => d.embedding);
  }
}
