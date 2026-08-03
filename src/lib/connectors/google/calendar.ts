/** GoogleCalendarProvider — stateless REST client. Refresh/decryption live in the
 *  credential layer; this only takes an access token. */
import type {
  CalendarEvent,
  CalendarProvider,
  ListEventsOptions,
} from "@/lib/connectors/types";

const BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

interface GEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email: string }[];
}

function mapEvent(e: GEvent): CalendarEvent {
  return {
    id: e.id,
    title: e.summary ?? "(no title)",
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? "",
    description: e.description,
    location: e.location,
    attendees: e.attendees?.map((a) => a.email),
  };
}

function toGoogle(ev: Partial<Omit<CalendarEvent, "id">>): Record<string, unknown> {
  const g: Record<string, unknown> = {};
  if (ev.title !== undefined) g.summary = ev.title;
  if (ev.description !== undefined) g.description = ev.description;
  if (ev.location !== undefined) g.location = ev.location;
  if (ev.start !== undefined) g.start = { dateTime: ev.start };
  if (ev.end !== undefined) g.end = { dateTime: ev.end };
  if (ev.attendees !== undefined) g.attendees = ev.attendees.map((email) => ({ email }));
  return g;
}

async function call<T>(url: string, token: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Google Calendar ${method} → ${res.status}`);
  return method === "DELETE" ? (undefined as T) : ((await res.json()) as T);
}

export const googleCalendar: CalendarProvider = {
  kind: "google_calendar",

  async listEvents(token, opts: ListEventsOptions = {}) {
    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: String(opts.max ?? 25),
    });
    if (opts.timeMin) params.set("timeMin", opts.timeMin);
    if (opts.timeMax) params.set("timeMax", opts.timeMax);
    const json = await call<{ items: GEvent[] }>(`${BASE}?${params.toString()}`, token, "GET");
    return (json.items ?? []).map(mapEvent);
  },

  async createEvent(token, event) {
    const json = await call<GEvent>(BASE, token, "POST", toGoogle(event));
    return mapEvent(json);
  },

  async updateEvent(token, id, patch) {
    const json = await call<GEvent>(`${BASE}/${id}`, token, "PATCH", toGoogle(patch));
    return mapEvent(json);
  },

  async deleteEvent(token, id) {
    await call<void>(`${BASE}/${id}`, token, "DELETE");
  },
};
