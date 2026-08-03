/**
 * Lightweight diagnostics — for the team building STOS, not end users. Fire-and-forget writes to a
 * `telemetry` collection; never throws, never blocks a request. Captures feature usage, failed
 * ingestion, failed AI, search misses, upload failures, and slow operations so improvements are
 * evidence-based, not guesswork.
 */
import { db } from "@/lib/mongo";

export type TelemetryKind = "feature" | "ingestion" | "ai" | "search" | "upload" | "slow" | "error" | "intent";

export interface TelemetryEvent {
  kind: TelemetryKind;
  event: string;
  meta?: Record<string, unknown>;
  at: Date;
}

/** Fire-and-forget record. Swallows all errors so diagnostics never affect the product. */
export function record(kind: TelemetryKind, event: string, meta?: Record<string, unknown>): void {
  void (async () => {
    try {
      const d = await db();
      await d.collection("telemetry").insertOne({ kind, event, meta: meta ?? {}, at: new Date() });
    } catch {
      /* diagnostics must never break the app */
    }
  })();
}

/** Read-side: counts by kind/event + recent failures (owner diagnostics view). */
export async function summary(): Promise<{
  counts: { kind: string; event: string; count: number }[];
  recentFailures: TelemetryEvent[];
  total: number;
}> {
  const d = await db();
  const col = d.collection<TelemetryEvent>("telemetry");
  const counts = await col
    .aggregate<{ _id: { kind: string; event: string }; count: number }>([
      { $group: { _id: { kind: "$kind", event: "$event" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 40 },
    ])
    .toArray();
  const recentFailures = await col
    .find({ event: { $in: ["failed", "miss", "error"] } })
    .sort({ at: -1 })
    .limit(20)
    .toArray();
  const total = await col.estimatedDocumentCount();
  return {
    counts: counts.map((c) => ({ kind: c._id.kind, event: c._id.event, count: c.count })),
    recentFailures,
    total,
  };
}
