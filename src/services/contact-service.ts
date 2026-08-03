import { repo, toDTO } from "@/data/collection";
import * as audit from "@/lib/audit";
import { activityService } from "@/services/activity-service";
import { NotFound } from "@/lib/errors";
import type { Contact, DTO } from "@/lib/entities";
import type { User } from "@/lib/types";
import type { z } from "zod";
import type { ContactCreateSchema, ContactUpdateSchema } from "@/lib/schemas/entities";

const contacts = repo<Contact>("contacts", { workspaceScoped: true });

export const contactService = {
  async create(user: User, input: z.infer<typeof ContactCreateSchema>): Promise<DTO<Contact>> {
    const doc = await contacts.insert(user.orgId, { ...input, ownerId: user.id });
    const id = doc._id.toHexString();
    await audit.record({ actor: user, action: "contact.create", entity: id });
    await activityService.log(user, "contact", id, "created", `Contact ${input.name} created`);
    return toDTO(doc);
  },
  async list(user: User): Promise<DTO<Contact>[]> {
    return (await contacts.list(user.orgId)).map(toDTO);
  },
  async get(user: User, id: string): Promise<DTO<Contact>> {
    const doc = await contacts.findById(user.orgId, id);
    if (!doc) throw new NotFound("contact not found");
    return toDTO(doc);
  },
  async update(
    user: User,
    id: string,
    patch: z.infer<typeof ContactUpdateSchema>,
  ): Promise<DTO<Contact>> {
    const doc = await contacts.update(user.orgId, id, patch as Partial<Contact>);
    if (!doc) throw new NotFound("contact not found");
    await audit.record({ actor: user, action: "contact.update", entity: id });
    return toDTO(doc);
  },
  async remove(user: User, id: string): Promise<void> {
    if (!(await contacts.softDelete(user.orgId, id))) throw new NotFound("contact not found");
    await audit.record({ actor: user, action: "contact.delete", entity: id });
  },
};
