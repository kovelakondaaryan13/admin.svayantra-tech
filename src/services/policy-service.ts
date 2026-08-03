/** Business policy management (configurable rules editable by owners/admins). */
import { repo, toDTO } from "@/data/collection";
import * as audit from "@/lib/audit";
import { assertPermission } from "@/lib/iam";
import { NotFound } from "@/lib/errors";
import type { Policy } from "@/lib/platform/entities";
import type { DTO } from "@/lib/entities";
import type { User } from "@/lib/types";

const policies = repo<Policy>("policies");

export interface PolicyInput {
  key: string;
  label: string;
  domain: string;
  effect: Policy["effect"];
  value?: number;
  roles?: string[];
  description?: string;
  enabled?: boolean;
}

export const policyService = {
  async list(user: User): Promise<DTO<Policy>[]> {
    assertPermission(user, "policies.manage");
    return (await policies.list(user.orgId)).map(toDTO);
  },

  async create(user: User, input: PolicyInput): Promise<DTO<Policy>> {
    assertPermission(user, "policies.manage");
    const doc = await policies.insert(user.orgId, {
      key: input.key,
      label: input.label,
      domain: input.domain,
      effect: input.effect,
      value: input.value,
      roles: input.roles ?? [],
      description: input.description,
      enabled: input.enabled ?? true,
    });
    await audit.record({ actor: user, action: "policy.create", entity: doc._id.toHexString(), meta: { key: input.key } });
    return toDTO(doc);
  },

  async update(user: User, id: string, patch: Partial<PolicyInput>): Promise<DTO<Policy>> {
    assertPermission(user, "policies.manage");
    const doc = await policies.update(user.orgId, id, patch as Partial<Policy>);
    if (!doc) throw new NotFound("policy not found");
    await audit.record({ actor: user, action: "policy.update", entity: id });
    return toDTO(doc);
  },
};
