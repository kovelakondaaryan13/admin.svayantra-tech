/**
 * Custom object platform — metadata definitions. An org defines an object type
 * (factory, machine, patient, project…) with fields + relationships; records then
 * get CRUD/permissions/audit/AI-search for free. No code per object.
 */
import { repo, toDTO } from "@/data/collection";
import * as audit from "@/lib/audit";
import { assertPermission } from "@/lib/iam";
import { NotFound, Conflict } from "@/lib/errors";
import type { ObjectDefinition } from "@/lib/platform/entities";
import type { DTO } from "@/lib/entities";
import type { User } from "@/lib/types";

const defs = repo<ObjectDefinition>("objectDefinitions");

export interface ObjectDefinitionInput {
  key: string;
  label: string;
  labelPlural: string;
  icon?: string;
  fields: ObjectDefinition["fields"];
  relationships?: ObjectDefinition["relationships"];
  displayField: string;
  permissions?: string[];
  aiSearchable?: boolean;
}

export const objectDefinitionService = {
  async list(user: User): Promise<DTO<ObjectDefinition>[]> {
    assertPermission(user, "objects.read");
    return (await defs.list(user.orgId, {}, 500)).map(toDTO);
  },

  async getByKey(user: User, key: string): Promise<ObjectDefinition | null> {
    return (await defs.list(user.orgId, { key } as never))[0] ?? null;
  },

  async create(user: User, input: ObjectDefinitionInput): Promise<DTO<ObjectDefinition>> {
    assertPermission(user, "objects.manage");
    if (await this.getByKey(user, input.key)) throw new Conflict(`object '${input.key}' already exists`);
    const doc = await defs.insert(user.orgId, {
      key: input.key,
      label: input.label,
      labelPlural: input.labelPlural,
      icon: input.icon,
      fields: input.fields,
      relationships: input.relationships ?? [],
      displayField: input.displayField,
      permissions: input.permissions ?? [],
      aiSearchable: input.aiSearchable ?? true,
    });
    await audit.record({ actor: user, action: "object.define", entity: doc._id.toHexString(), meta: { key: input.key } });
    return toDTO(doc);
  },

  async update(user: User, id: string, patch: Partial<ObjectDefinitionInput>): Promise<DTO<ObjectDefinition>> {
    assertPermission(user, "objects.manage");
    const updated = await defs.update(user.orgId, id, patch as Partial<ObjectDefinition>);
    if (!updated) throw new NotFound("object definition not found");
    await audit.record({ actor: user, action: "object.redefine", entity: id });
    return toDTO(updated);
  },
};
