/**
 * The single database bootstrap path. Every script, service, and Better Auth import
 * the connection layer from here. See ./client.ts (singleton) and ./dns.ts (resolver).
 */
export { getClient, getClientSync, getDb, ping, closeDatabase } from "@/lib/database/client";
export { configureDns } from "@/lib/database/dns";
