import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const projectRoot = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The MongoDB driver and Better Auth run in Node route handlers (not Edge). The document
  // parsers (mammoth/pdf-parse/xlsx) are loaded via dynamic import in the ingestion pipeline —
  // they MUST be external so Next resolves them from node_modules at runtime instead of bundling
  // them (bundling breaks the dynamic import and makes extraction wrongly report "not installed").
  serverExternalPackages: ["mongodb", "better-auth", "mammoth", "pdf-parse", "xlsx"],
  // Pin the workspace root (a parent-dir lockfile otherwise confuses inference).
  outputFileTracingRoot: projectRoot,
  // Lint is run explicitly via `npm run lint`; keep it out of the build path.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
