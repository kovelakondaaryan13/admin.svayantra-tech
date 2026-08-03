/**
 * Calendar operations through the connector abstraction. The AI and routes call this;
 * it resolves the provider, mints a fresh (decrypted, auto-refreshed) access token,
 * and delegates. Swapping Google for Outlook is a registry change, not a service one.
 */
import { getConnector } from "@/lib/connectors/registry";
import { getFreshAccessToken } from "@/lib/connectors/credentials";
import { BusinessRule } from "@/lib/errors";
import type { CalendarEvent, ListEventsOptions, ConnectorKind } from "@/lib/connectors/types";
import type { User } from "@/lib/types";

function resolve(kind: ConnectorKind = "google_calendar") {
  const c = getConnector(kind);
  if (!c?.calendar || !c.oauth) throw new BusinessRule(`calendar connector '${kind}' unavailable`);
  return { calendar: c.calendar, oauth: c.oauth };
}

export const calendarService = {
  async list(user: User, opts?: ListEventsOptions): Promise<CalendarEvent[]> {
    const { calendar, oauth } = resolve();
    const token = await getFreshAccessToken(user, "google_calendar", oauth);
    return calendar.listEvents(token, opts);
  },
  async create(user: User, event: Omit<CalendarEvent, "id">): Promise<CalendarEvent> {
    const { calendar, oauth } = resolve();
    const token = await getFreshAccessToken(user, "google_calendar", oauth);
    return calendar.createEvent(token, event);
  },
  async update(user: User, id: string, patch: Partial<Omit<CalendarEvent, "id">>): Promise<CalendarEvent> {
    const { calendar, oauth } = resolve();
    const token = await getFreshAccessToken(user, "google_calendar", oauth);
    return calendar.updateEvent(token, id, patch);
  },
  async remove(user: User, id: string): Promise<void> {
    const { calendar, oauth } = resolve();
    const token = await getFreshAccessToken(user, "google_calendar", oauth);
    return calendar.deleteEvent(token, id);
  },
};
