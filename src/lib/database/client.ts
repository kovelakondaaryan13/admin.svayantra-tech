/**
 * The ONE MongoDB client for the whole application. Serverless-/HMR-safe singleton
 * on globalThis, shared by the app, the scripts, AND Better Auth — there is exactly
 * one MongoClient. Connection is lazy, retried, logged, and health-checkable, with
 * graceful shutdown. DNS is configured co-located with client creation/connection
 * (see ./dns.ts for why that placement matters).
 */
import { MongoClient, type Db } from "mongodb";
import dns from "node:dns";
import { configureDns } from "@/lib/database/dns";
import { env } from "@/lib/env";

interface Store {
  client: MongoClient;
  connecting?: Promise<MongoClient>;
  shutdownHooked?: boolean;
}

const globalRef = globalThis as unknown as { __revenueosDb?: Store };

const CLIENT_OPTIONS = {
  serverSelectionTimeoutMS: 10_000,
  maxPoolSize: 10,
  retryWrites: true,
};

/** Get (creating if needed) the singleton client — NOT necessarily connected yet. */
function store(): Store {
  if (!globalRef.__revenueosDb) {
    // Co-located: configure DNS in this very context, immediately before creating
    // the client that will resolve SRV.
    configureDns();
    const client = new MongoClient(env.MONGODB_URI(), CLIENT_OPTIONS);
    globalRef.__revenueosDb = { client };
    hookGracefulShutdown();
  }
  return globalRef.__revenueosDb;
}

/**
 * The raw (possibly-unconnected) client. Used by Better Auth's adapter, which needs
 * a Db synchronously and connects lazily on first use — by which point DNS has been
 * configured (here + at boot in instrumentation).
 */
export function getClientSync(): MongoClient {
  return store().client;
}

async function connectWithRetry(client: MongoClient, attempts = 3): Promise<MongoClient> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      // Re-apply DNS in THIS async context right before SRV resolution happens.
      configureDns();
      console.log(
        `[database] connecting (attempt ${attempt}/${attempts}); resolver=${dns.getServers().join(",")}`,
      );
      await client.connect();
      await client.db(env.MONGODB_DB()).command({ ping: 1 });
      console.log("[database] connected + ping OK");
      return client;
    } catch (err) {
      lastError = err;
      const code = (err as { code?: string }).code ?? (err as Error).name;
      console.error(
        `[database] connect attempt ${attempt} failed: ${code} — ${String((err as Error).message).split("\n")[0]}`,
      );
      if (attempt < attempts) await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  throw lastError;
}

/** Get the connected singleton client (connects once, retries on failure). */
export async function getClient(): Promise<MongoClient> {
  const s = store();
  if (!s.connecting) {
    s.connecting = connectWithRetry(s.client).catch((err) => {
      s.connecting = undefined; // allow a later retry after a failed connect
      throw err;
    });
  }
  return s.connecting;
}

/** The application database handle. */
export async function getDb(): Promise<Db> {
  return (await getClient()).db(env.MONGODB_DB());
}

/** Health check — true if the DB answers a ping. */
export async function ping(): Promise<boolean> {
  try {
    await (await getDb()).command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

/** Graceful shutdown. */
export async function closeDatabase(): Promise<void> {
  if (globalRef.__revenueosDb) {
    await globalRef.__revenueosDb.client.close().catch(() => {});
    globalRef.__revenueosDb = undefined;
  }
}

function hookGracefulShutdown(): void {
  const s = globalRef.__revenueosDb;
  if (!s || s.shutdownHooked) return;
  s.shutdownHooked = true;
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void closeDatabase().finally(() => process.exit(0));
    });
  }
}
