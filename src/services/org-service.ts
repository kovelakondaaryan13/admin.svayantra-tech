/** Organization directory — the tenant record itself (name, slug, owner, plan). */
import { repo, toDTO } from "@/data/collection";
import type { Organization } from "@/lib/org-entities";
import type { DTO } from "@/lib/entities";

const orgs = repo<Organization>("organizations");

export const orgService = {
  /** Idempotently ensure an Organization document exists for this tenant (JIT-provision on first login/bootstrap). */
  async ensureOrganization(orgId: string, name: string, ownerUserId: string): Promise<DTO<Organization>> {
    const existing = (await orgs.list(orgId))[0];
    if (existing) return toDTO(existing);
    const doc = await orgs.insert(orgId, { name, slug: orgId, ownerUserId, plan: "startup", status: "active" });
    return toDTO(doc);
  },
};
