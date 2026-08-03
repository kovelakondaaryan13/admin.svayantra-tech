import { repo, toDTO } from "@/data/collection";
import * as audit from "@/lib/audit";
import { activityService } from "@/services/activity-service";
import { NotFound } from "@/lib/errors";
import type { Company, DTO } from "@/lib/entities";
import type { User } from "@/lib/types";
import type { z } from "zod";
import type { CompanyCreateSchema, CompanyUpdateSchema } from "@/lib/schemas/entities";

const companies = repo<Company>("companies", { workspaceScoped: true });

export const companyService = {
  async create(user: User, input: z.infer<typeof CompanyCreateSchema>): Promise<DTO<Company>> {
    const doc = await companies.insert(user.orgId, { ...input, ownerId: user.id });
    const id = doc._id.toHexString();
    await audit.record({ actor: user, action: "company.create", entity: id });
    await activityService.log(user, "company", id, "created", `Company ${input.name} created`);
    return toDTO(doc);
  },
  async list(user: User): Promise<DTO<Company>[]> {
    return (await companies.list(user.orgId)).map(toDTO);
  },
  async get(user: User, id: string): Promise<DTO<Company>> {
    const doc = await companies.findById(user.orgId, id);
    if (!doc) throw new NotFound("company not found");
    return toDTO(doc);
  },
  async update(
    user: User,
    id: string,
    patch: z.infer<typeof CompanyUpdateSchema>,
  ): Promise<DTO<Company>> {
    const doc = await companies.update(user.orgId, id, patch as Partial<Company>);
    if (!doc) throw new NotFound("company not found");
    await audit.record({ actor: user, action: "company.update", entity: id });
    return toDTO(doc);
  },
  async remove(user: User, id: string): Promise<void> {
    if (!(await companies.softDelete(user.orgId, id))) throw new NotFound("company not found");
    await audit.record({ actor: user, action: "company.delete", entity: id });
  },
};
