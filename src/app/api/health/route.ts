import { ok, handleError } from "@/lib/http";
import { ping } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const checks: Record<string, { status: "healthy" | "degraded" | "down"; latencyMs?: number }> = {};

    // Database check
    try {
      const t0 = Date.now();
      const alive = await ping();
      checks.database = { status: alive ? "healthy" : "down", latencyMs: Date.now() - t0 };
    } catch {
      checks.database = { status: "down" };
    }

    // AI check (just verify the client can be imported)
    try {
      const { claude } = await import("@/ai/claude");
      checks.ai = { status: claude ? "healthy" : "down" };
    } catch {
      checks.ai = { status: "down" };
    }

    const overall = Object.values(checks).every(c => c.status === "healthy")
      ? "healthy"
      : Object.values(checks).some(c => c.status === "down")
        ? "degraded"
        : "healthy";

    return ok({ status: overall, checks, timestamp: new Date().toISOString() });
  } catch (err) {
    return handleError(err);
  }
}
