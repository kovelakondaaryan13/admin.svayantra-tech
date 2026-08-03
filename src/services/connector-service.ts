/**
 * Connector orchestration on top of the provider-agnostic registry + encrypted
 * credential store. Health/test-connection is the one piece the raw credential layer
 * doesn't own: it mints a fresh token (refreshing if needed) and does a lightweight
 * live call to prove the integration actually works, then records the result.
 */
import { getConnector } from "@/lib/connectors/registry";
import {
  getCredential,
  getFreshAccessToken,
  markStatus,
} from "@/lib/connectors/credentials";
import type { ConnectorKind } from "@/lib/connectors/types";
import type { User } from "@/lib/types";

export interface ConnectionTest {
  kind: ConnectorKind;
  supported: boolean; // is this an OAuth connector we can test?
  connected: boolean;
  healthy: boolean;
  checkedAt: string;
  accountEmail?: string;
  detail: string;
}

export const connectorService = {
  /** Test a connector end-to-end: refresh token + one live read. Records health. */
  async test(user: User, kind: ConnectorKind): Promise<ConnectionTest> {
    const checkedAt = new Date().toISOString();
    const descriptor = getConnector(kind);
    if (!descriptor?.oauth) {
      return { kind, supported: false, connected: false, healthy: false, checkedAt, detail: "This connector isn't testable yet." };
    }
    const cred = await getCredential(user, kind);
    if (!cred) {
      return { kind, supported: true, connected: false, healthy: false, checkedAt, detail: "Not connected." };
    }
    try {
      const token = await getFreshAccessToken(user, kind, descriptor.oauth); // refreshes if expired
      let detail = "Token valid.";
      if (descriptor.calendar) {
        const events = await descriptor.calendar.listEvents(token, { max: 1 });
        detail = `Live read OK — reached the provider (${events.length} recent event(s)).`;
      }
      await markStatus(user, kind, "connected", true);
      return { kind, supported: true, connected: true, healthy: true, checkedAt, accountEmail: cred.accountEmail, detail };
    } catch (err) {
      await markStatus(user, kind, "error");
      return {
        kind,
        supported: true,
        connected: true,
        healthy: false,
        checkedAt,
        accountEmail: cred.accountEmail,
        detail: err instanceof Error ? err.message : "Connection test failed.",
      };
    }
  },
};
