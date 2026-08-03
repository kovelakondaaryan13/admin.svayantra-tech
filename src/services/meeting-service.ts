import { repo, toDTO } from "@/data/collection";
import * as audit from "@/lib/audit";
import { activityService } from "@/services/activity-service";
import { NotFound } from "@/lib/errors";
import type { Meeting, DTO } from "@/lib/entities";
import type { User } from "@/lib/types";
import type { z } from "zod";
import type { MeetingCreateSchema, MeetingUpdateSchema } from "@/lib/schemas/entities";

const meetings = repo<Meeting>("meetings", { workspaceScoped: true });

export const meetingService = {
  async create(user: User, input: z.infer<typeof MeetingCreateSchema>): Promise<DTO<Meeting>> {
    const doc = await meetings.insert(user.orgId, {
      title: input.title,
      at: new Date(input.at),
      ownerId: user.id,
      leadId: input.leadId,
      contactId: input.contactId,
      notes: input.notes,
    });
    const id = doc._id.toHexString();
    await audit.record({ actor: user, action: "meeting.create", entity: id });
    await activityService.log(user, "meeting", id, "created", `Meeting "${input.title}"`);
    return toDTO(doc);
  },
  async list(user: User): Promise<DTO<Meeting>[]> {
    return (await meetings.list(user.orgId)).map(toDTO);
  },
  async get(user: User, id: string): Promise<DTO<Meeting>> {
    const doc = await meetings.findById(user.orgId, id);
    if (!doc) throw new NotFound("meeting not found");
    return toDTO(doc);
  },
  async update(
    user: User,
    id: string,
    input: z.infer<typeof MeetingUpdateSchema>,
  ): Promise<DTO<Meeting>> {
    const patch: Partial<Meeting> = { ...(input as Partial<Meeting>) };
    if (input.at) patch.at = new Date(input.at);
    const doc = await meetings.update(user.orgId, id, patch);
    if (!doc) throw new NotFound("meeting not found");
    await audit.record({ actor: user, action: "meeting.update", entity: id });
    return toDTO(doc);
  },
  async remove(user: User, id: string): Promise<void> {
    if (!(await meetings.softDelete(user.orgId, id))) throw new NotFound("meeting not found");
    await audit.record({ actor: user, action: "meeting.delete", entity: id });
  },
};
