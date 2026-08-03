/**
 * Unified knowledge search: operational data (MongoDB) + knowledge (Notion, behind
 * a swappable interface, OFF the AI critical path). Semantic/vector search will use
 * MongoDB Atlas Vector Search when needed (ADR-003) — Qdrant deferred.
 * Guide: .claude/skills/integrations/integrate-external-api.md
 */
import { leadService } from "@/services/lead-service";
import { companyService } from "@/services/company-service";
import { contactService } from "@/services/contact-service";
import type { User } from "@/lib/types";

export interface KnowledgeHit {
  source: "lead" | "company" | "contact" | "notion";
  id: string;
  title: string;
  subtitle?: string;
}

/** Notion knowledge interface. Stubbed for M1 — returns [] until wired. */
async function searchNotion(_query: string): Promise<KnowledgeHit[]> {
  // Real implementation caches Notion page pointers in Mongo (knowledgeIndex) and
  // never blocks the AI path. Returns empty until NOTION_API_KEY is configured.
  return [];
}

export const knowledgeService = {
  async search(user: User, query: string): Promise<KnowledgeHit[]> {
    const q = query.trim();
    if (!q) return [];

    const [leads, companies, contacts, notion] = await Promise.all([
      leadService.search(user, q),
      companyService.list(user),
      contactService.list(user),
      searchNotion(q),
    ]);

    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const hits: KnowledgeHit[] = [
      ...leads.map((l) => ({ source: "lead" as const, id: l.id, title: l.name, subtitle: l.stage })),
      ...companies
        .filter((c) => rx.test(c.name) || (c.domain ? rx.test(c.domain) : false))
        .map((c) => ({ source: "company" as const, id: c.id, title: c.name, subtitle: c.industry })),
      ...contacts
        .filter((c) => rx.test(c.name) || (c.email ? rx.test(c.email) : false))
        .map((c) => ({ source: "contact" as const, id: c.id, title: c.name, subtitle: c.title })),
      ...notion,
    ];
    return hits.slice(0, 50);
  },
};
