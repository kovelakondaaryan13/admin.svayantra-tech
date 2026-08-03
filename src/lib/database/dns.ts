/**
 * DNS resolver configuration — the SINGLE place DNS is initialized.
 *
 * Root cause (proven by src/lib/database/diagnose.ts):
 *   Node exposes TWO independent default DNS resolvers — the callback API (`dns.*`)
 *   and the promise API (`dns.promises` === `node:dns/promises`). They do NOT stay in
 *   sync. `dns.setServers()` updates ONLY the callback resolver. Next.js initializes
 *   the promise resolver during startup, pinned to the system default `127.0.0.1`
 *   (a c-ares quirk on this machine). The mongodb driver resolves SRV via
 *   `dns.promises.resolveSrv` (mongodb/lib/connection_string.js), so it kept using the
 *   stale `127.0.0.1` promise resolver → `querySrv ECONNREFUSED`, even though
 *   `dns.getServers()` reported the correct servers.
 *
 * Fix: set the servers on BOTH resolver channels. Config-driven via DNS_SERVERS;
 * unset in environments where the default resolver already works (Vercel/prod) and
 * this is a no-op.
 */
import dns from "node:dns";
import dnsPromises from "node:dns/promises";

let logged = false;

export function configureDns(): void {
  const raw = process.env.DNS_SERVERS?.trim();
  if (!raw) return; // no override → keep the platform default (e.g. Vercel)

  const servers = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (servers.length === 0) return;

  // BOTH channels must be set — the callback resolver AND the promise resolver the
  // mongodb driver actually uses. Setting only dns.setServers() leaves the promise
  // resolver on 127.0.0.1 and the driver still fails.
  dns.setServers(servers);
  dnsPromises.setServers(servers);

  if (!logged) {
    console.log(`[database] DNS resolvers (callback + promise) configured → ${servers.join(", ")}`);
    logged = true;
  }
}
