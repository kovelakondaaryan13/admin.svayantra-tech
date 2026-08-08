/**
 * Connector abstractions — first-class, provider-agnostic. Google Calendar is the
 * first implementation; Drive/Gmail/Slack/Notion/WhatsApp/Outlook/etc. implement the
 * same interfaces. The AI depends on THESE interfaces + the internal knowledge layer,
 * never on a specific vendor.
 */
import type { ConnectorKind } from "@/lib/knowledge-entities";

export type { ConnectorKind };

export interface TokenBundle {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  accountEmail?: string;
}

/** OAuth 2.0 connectors implement this (authorize → exchange → refresh). */
export interface OAuthProvider {
  readonly kind: ConnectorKind;
  isConfigured(): boolean;
  authUrl(state: string): string;
  exchangeCode(code: string): Promise<TokenBundle>;
  refresh(refreshToken: string): Promise<TokenBundle>;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  description?: string;
  location?: string;
  attendees?: string[];
  conferenceUrl?: string; // populated on read once a video-conference link exists
  requestConference?: boolean; // on create: ask the provider to generate one (e.g. Google Meet)
}

export interface ListEventsOptions {
  timeMin?: string;
  timeMax?: string;
  max?: number;
}

/** Calendar providers implement this. Methods take an access token; the credential
 *  layer owns decryption + refresh, keeping providers stateless and testable. */
export interface CalendarProvider {
  readonly kind: ConnectorKind;
  listEvents(accessToken: string, opts?: ListEventsOptions): Promise<CalendarEvent[]>;
  createEvent(accessToken: string, event: Omit<CalendarEvent, "id">): Promise<CalendarEvent>;
  updateEvent(
    accessToken: string,
    id: string,
    patch: Partial<Omit<CalendarEvent, "id">>,
  ): Promise<CalendarEvent>;
  deleteEvent(accessToken: string, id: string): Promise<void>;
}
