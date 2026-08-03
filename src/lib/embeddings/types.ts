/** Provider-agnostic embedding interface. Swap Voyage for any model without touching callers. */
export interface EmbeddingProvider {
  readonly model: string;
  readonly dimension: number;
  /** Returns one vector per input text. `inputType` lets asymmetric models optimize. */
  embed(texts: string[], inputType: "document" | "query"): Promise<number[][]>;
  isConfigured(): boolean;
}
