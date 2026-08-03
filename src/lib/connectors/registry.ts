/**
 * Connector registry — the catalog of first-class integrations. Google Calendar is
 * live; the rest are declared with a stable interface so adding them is wiring, not
 * redesign. Notion is intentionally a FUTURE connector: the AI depends on the internal
 * knowledge layer, never on Notion directly (Part 6).
 */
import { googleOAuth } from "@/lib/connectors/google/oauth";
import { googleCalendar } from "@/lib/connectors/google/calendar";
import type { CalendarProvider, ConnectorKind, OAuthProvider } from "@/lib/connectors/types";

export type ConnectorCategory = "calendar" | "storage" | "messaging" | "docs";
export type ConnectorAvailability = "configured" | "available" | "planned";

export interface ConnectorDescriptor {
  kind: ConnectorKind;
  label: string;
  category: ConnectorCategory;
  availability: ConnectorAvailability;
  oauth?: OAuthProvider;
  calendar?: CalendarProvider;
}

export const connectorRegistry: ConnectorDescriptor[] = [
  {
    kind: "google_calendar",
    label: "Google Calendar",
    category: "calendar",
    availability: googleOAuth.isConfigured() ? "configured" : "available",
    oauth: googleOAuth,
    calendar: googleCalendar,
  },
  { kind: "google_drive", label: "Google Drive", category: "storage", availability: "planned" },
  { kind: "gmail", label: "Gmail", category: "messaging", availability: "planned" },
  { kind: "slack", label: "Slack", category: "messaging", availability: "planned" },
  { kind: "notion", label: "Notion", category: "docs", availability: "planned" },
  { kind: "whatsapp", label: "WhatsApp", category: "messaging", availability: "planned" },
  { kind: "outlook", label: "Outlook", category: "calendar", availability: "planned" },
  { kind: "confluence", label: "Confluence", category: "docs", availability: "planned" },
  { kind: "dropbox", label: "Dropbox", category: "storage", availability: "planned" },
  { kind: "sharepoint", label: "SharePoint", category: "storage", availability: "planned" },
];

export function getConnector(kind: ConnectorKind): ConnectorDescriptor | undefined {
  return connectorRegistry.find((c) => c.kind === kind);
}
