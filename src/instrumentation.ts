/**
 * Next.js instrumentation — runs once when the server runtime boots, before any
 * request is served. This is the correct place to initialize DNS and warm the
 * shared DB connection in the SAME runtime that handles requests, so the driver's
 * SRV resolution uses the configured resolver (fixes `querySrv ECONNREFUSED`).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { configureDns, getClient } = await import("@/lib/database");
    configureDns();
    try {
      await getClient(); // establish the shared, DNS-configured connection at boot
    } catch (err) {
      console.error("[instrumentation] initial DB connection failed at boot:", err);
    }
  }
}
