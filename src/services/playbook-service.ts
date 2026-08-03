/** Operating Playbooks — reusable pipeline definitions (stages + SLAs + criteria). */
import { repo, toDTO } from "@/data/collection";
import * as audit from "@/lib/audit";
import { assertPermission } from "@/lib/iam";
import { NotFound } from "@/lib/errors";
import type { Playbook, PlaybookStage } from "@/lib/sales-entities";
import type { DTO } from "@/lib/entities";
import type { ExecutionModel, User } from "@/lib/types";

const playbooks = repo<Playbook>("playbooks");

export interface PlaybookInput {
  key: string;
  label: string;
  model: ExecutionModel;
  description?: string;
  stages: PlaybookStage[];
  kpis?: string[];
  enabled?: boolean;
}

export const playbookService = {
  async list(user: User): Promise<DTO<Playbook>[]> {
    return (await playbooks.list(user.orgId, {}, 100)).map(toDTO);
  },
  async getByKey(user: User, key: string): Promise<DTO<Playbook> | null> {
    const rows = await playbooks.list(user.orgId, { key } as never, 1);
    return rows[0] ? toDTO(rows[0]) : null;
  },
  async create(user: User, input: PlaybookInput): Promise<DTO<Playbook>> {
    assertPermission(user, "workflows.manage");
    const doc = await playbooks.insert(user.orgId, {
      key: input.key,
      label: input.label,
      model: input.model,
      description: input.description,
      stages: input.stages,
      kpis: input.kpis,
      enabled: input.enabled ?? true,
    });
    await audit.record({ actor: user, action: "playbook.create", entity: doc._id.toHexString(), meta: { key: input.key } });
    return toDTO(doc);
  },
  async remove(user: User, id: string): Promise<void> {
    assertPermission(user, "workflows.manage");
    if (!(await playbooks.softDelete(user.orgId, id))) throw new NotFound("playbook not found");
    await audit.record({ actor: user, action: "playbook.delete", entity: id });
  },
};
