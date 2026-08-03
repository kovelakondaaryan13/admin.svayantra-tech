/**
 * Backward-compatible database handle. The single source of truth for all Mongo
 * access is `@/lib/database` (singleton client + DNS bootstrap). Existing callers
 * use `db()`; keep importing this or `@/lib/database` — both resolve to one client.
 */
export { getDb as db } from "@/lib/database";
