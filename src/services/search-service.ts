/**
 * Global search for the ⌘K command palette. Searches across leads, companies, employees, and
 * knowledge documents — permission-gated per type and workspace-isolated (reads flow through
 * the scoped data layer, so demo/production never mix). Small result caps keep it instant.
 */
import { leads as leadsData, toDTO as leadToDTO } from "@/data/leads";
import { companyService } from "@/services/company-service";
import { employeeService } from "@/services/employee-service";
import { documentService } from "@/services/document-service";
import { can } from "@/lib/iam";
import type { User } from "@/lib/types";

export interface SearchResult {
  type: "lead" | "company" | "employee" | "document";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}

const includesQ = (q: string) => (s?: string) => (s ?? "").toLowerCase().includes(q);

export const searchService = {
  async global(user: User, query: string): Promise<SearchResult[]> {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    const out: SearchResult[] = [];

    if (can(user, "crm.read")) {
      const leads = await leadsData.search(user.orgId, q, 6).catch(() => []);
      for (const l of leads) {
        const d = leadToDTO(l);
        out.push({ type: "lead", id: d.id, title: d.name, subtitle: `Lead · ${d.stage}`, href: `/work/${d.id}` });
      }
      const companies = await companyService.list(user).catch(() => []);
      for (const c of companies.filter((c) => includesQ(q)(c.name)).slice(0, 5)) {
        out.push({ type: "company", id: c.id, title: c.name, subtitle: `Company${c.industry ? " · " + c.industry : ""}`, href: "/work" });
      }
    }

    if (can(user, "users.read")) {
      const emps = await employeeService.list(user).catch(() => []);
      for (const e of emps.filter((e) => includesQ(q)(e.name) || includesQ(q)(e.email)).slice(0, 5)) {
        out.push({ type: "employee", id: e.id, title: e.name, subtitle: e.title ?? e.roleKey, href: "/people" });
      }
    }

    if (can(user, "ai.use") || can(user, "crm.read")) {
      const docs = await documentService.list(user).catch(() => []);
      for (const doc of docs.filter((d) => includesQ(q)(d.title)).slice(0, 5)) {
        out.push({ type: "document", id: doc.id, title: doc.title, subtitle: `Doc · ${doc.documentType}`, href: "/knowledge" });
      }
    }

    return out.slice(0, 16);
  },
};
