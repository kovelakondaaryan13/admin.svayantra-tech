/**
 * RBAC-filtered semantic retrieval. The org scope AND per-document role permissions
 * are enforced INSIDE the Qdrant query — a user can never retrieve a chunk they lack
 * access to. Returns hits with payload for context injection + citation.
 */
import { embeddingProvider } from "@/lib/embeddings";
import { qdrant, isQdrantConfigured, type SearchHit, type QdrantFilter } from "@/lib/qdrant/client";
import { isOwner } from "@/lib/iam";
import { activeWorkspace } from "@/lib/workspace";
import type { User } from "@/lib/types";

export interface RetrieveOptions {
  limit?: number;
  documentType?: string;
  companyId?: string;
  dealId?: string;
}

export async function retrieveKnowledge(
  user: User,
  query: string,
  opts: RetrieveOptions = {},
): Promise<SearchHit[]> {
  if (!isQdrantConfigured() || !query.trim()) return [];

  const provider = embeddingProvider();
  const [vector] = await provider.embed([query], "query");

  const must: unknown[] = [
    { key: "orgId", match: { value: user.orgId } },
    { key: "workspace", match: { value: await activeWorkspace() } },
  ];
  if (opts.documentType) must.push({ key: "documentType", match: { value: opts.documentType } });
  if (opts.companyId) must.push({ key: "companyId", match: { value: opts.companyId } });
  if (opts.dealId) must.push({ key: "dealId", match: { value: opts.dealId } });

  // RBAC: owners see all; others only see documents with empty permissions OR their role.
  if (!isOwner(user)) {
    must.push({
      should: [
        { is_empty: { key: "permissions" } },
        { key: "permissions", match: { any: [user.role] } },
      ],
    });
  }

  const filter: QdrantFilter = { must };
  return qdrant.search(vector, opts.limit ?? 8, filter);
}
