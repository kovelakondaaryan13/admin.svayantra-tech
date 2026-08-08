import { repo, toDTO } from "@/data/collection";
import * as audit from "@/lib/audit";
import { activityService } from "@/services/activity-service";
import { calendarService } from "@/services/calendar-service";
import { connectorStatuses } from "@/lib/connectors/credentials";
import { NotFound } from "@/lib/errors";
import type { Meeting, DTO } from "@/lib/entities";
import type { User } from "@/lib/types";
import type { z } from "zod";
import type { MeetingCreateSchema, MeetingUpdateSchema } from "@/lib/schemas/entities";

const meetings = repo<Meeting>("meetings", { workspaceScoped: true });

/** Default block length for a meeting on the calendar — meetings here are a single
 *  point in time (`at`), with no stored duration. */
const MEETING_BLOCK_MINUTES = 30;

async function hasGoogleCalendar(user: User): Promise<boolean> {
  const statuses = await connectorStatuses(user);
  return statuses.some((s) => s.kind === "google_calendar" && s.status === "connected");
}

export const meetingService = {
  async create(user: User, input: z.infer<typeof MeetingCreateSchema>): Promise<DTO<Meeting>> {
    const doc = await meetings.insert(user.orgId, {
      title: input.title,
      at: new Date(input.at),
      ownerId: user.id,
      leadId: input.leadId,
      contactId: input.contactId,
      companyId: input.companyId,
      notes: input.notes,
      transcript: input.transcript,
      summary: input.summary,
      attendees: input.attendees,
      actionItems: input.actionItems,
    });
    const id = doc._id.toHexString();
    await audit.record({ actor: user, action: "meeting.create", entity: id });
    await activityService.log(user, "meeting", id, "created", `Meeting "${input.title}"`);

    // Best-effort Google Calendar sync — never blocks or fails meeting creation.
    // Also requests a Google Meet link (conferenceDataVersion=1 under the hood).
    if (await hasGoogleCalendar(user)) {
      try {
        const end = new Date(doc.at.getTime() + MEETING_BLOCK_MINUTES * 60_000);
        const event = await calendarService.create(user, {
          title: doc.title,
          description: doc.notes,
          start: doc.at.toISOString(),
          end: end.toISOString(),
          requestConference: true,
        });
        const patch: Partial<Meeting> = { googleEventId: event.id };
        if (event.conferenceUrl) { patch.videoUrl = event.conferenceUrl; patch.videoProvider = "google_meet"; }
        await meetings.update(user.orgId, id, patch);
      } catch { /* calendar sync is best-effort; the meeting itself is already saved */ }
    }
    return toDTO((await meetings.findById(user.orgId, id)) ?? doc);
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

    if (doc.googleEventId && (await hasGoogleCalendar(user))) {
      try {
        const end = new Date(doc.at.getTime() + MEETING_BLOCK_MINUTES * 60_000);
        await calendarService.update(user, doc.googleEventId, {
          title: doc.title,
          description: doc.notes,
          start: doc.at.toISOString(),
          end: end.toISOString(),
        });
      } catch { /* calendar sync is best-effort */ }
    }
    return toDTO(doc);
  },
  async remove(user: User, id: string): Promise<void> {
    const existing = await meetings.findById(user.orgId, id);
    if (!existing) throw new NotFound("meeting not found");
    if (existing.googleEventId && (await hasGoogleCalendar(user))) {
      try {
        await calendarService.remove(user, existing.googleEventId);
      } catch { /* best-effort */ }
    }
    if (!(await meetings.softDelete(user.orgId, id))) throw new NotFound("meeting not found");
    await audit.record({ actor: user, action: "meeting.delete", entity: id });
  },
};
