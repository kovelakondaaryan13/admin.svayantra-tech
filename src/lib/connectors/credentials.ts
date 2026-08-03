/**
 * Encrypted connector credential store. OAuth refresh tokens are sealed at rest
 * (AES-256-GCM) and only decrypted server-side to mint short-lived access tokens.
 * Automatic refresh on expiry.
 */
import { repo } from "@/data/collection";
import { seal, open } from "@/lib/crypto/encryption";
import { NotFound } from "@/lib/errors";
import type { ConnectorCredential, ConnectorKind, ConnectorStatus } from "@/lib/knowledge-entities";
import type { OAuthProvider, TokenBundle } from "@/lib/connectors/types";
import type { User } from "@/lib/types";

const creds = repo<ConnectorCredential>("connectorCredentials");

interface SecretBundle {
  refreshToken?: string;
  accessToken: string;
  expiresAt?: string;
}

export async function getCredential(
  user: User,
  kind: ConnectorKind,
): Promise<ConnectorCredential | null> {
  const rows = await creds.list(user.orgId, { userId: user.id, kind } as never);
  return rows[0] ?? null;
}

export async function saveCredential(
  user: User,
  kind: ConnectorKind,
  bundle: TokenBundle,
): Promise<void> {
  const secret = seal(
    JSON.stringify({
      refreshToken: bundle.refreshToken,
      accessToken: bundle.accessToken,
      expiresAt: bundle.expiresAt?.toISOString(),
    } satisfies SecretBundle),
  );
  const fields = {
    kind,
    userId: user.id,
    accountEmail: bundle.accountEmail,
    scopes: bundle.scope ? bundle.scope.split(" ") : [],
    status: "connected" as ConnectorStatus,
    secret,
    expiresAt: bundle.expiresAt,
  };
  const existing = await getCredential(user, kind);
  if (existing) await creds.update(user.orgId, existing._id.toHexString(), fields as never);
  else await creds.insert(user.orgId, fields as never);
}

/** Returns a valid access token, refreshing (and re-sealing) if expired. */
export async function getFreshAccessToken(
  user: User,
  kind: ConnectorKind,
  provider: OAuthProvider,
): Promise<string> {
  const cred = await getCredential(user, kind);
  if (!cred) throw new NotFound(`${kind} not connected`);
  const bundle = JSON.parse(open(cred.secret)) as SecretBundle;

  const expired = bundle.expiresAt ? new Date(bundle.expiresAt).getTime() < Date.now() + 60_000 : true;
  if (expired && bundle.refreshToken) {
    const refreshed = await provider.refresh(bundle.refreshToken);
    await saveCredential(user, kind, { ...refreshed, accountEmail: cred.accountEmail });
    return refreshed.accessToken;
  }
  return bundle.accessToken;
}

export async function disconnect(user: User, kind: ConnectorKind): Promise<void> {
  const cred = await getCredential(user, kind);
  if (cred) await creds.softDelete(user.orgId, cred._id.toHexString());
}

/** Update a connector's health status (+ stamp last successful sync). */
export async function markStatus(
  user: User,
  kind: ConnectorKind,
  status: ConnectorStatus,
  synced = false,
): Promise<void> {
  const cred = await getCredential(user, kind);
  if (!cred) return;
  await creds.update(
    user.orgId,
    cred._id.toHexString(),
    { status, ...(synced ? { lastSyncedAt: new Date() } : {}) } as never,
  );
}

export async function connectorStatuses(
  user: User,
): Promise<{ kind: ConnectorKind; status: ConnectorStatus; accountEmail?: string; lastSyncedAt?: Date }[]> {
  const rows = await creds.list(user.orgId, { userId: user.id } as never);
  return rows.map((r) => ({
    kind: r.kind,
    status: r.status,
    accountEmail: r.accountEmail,
    lastSyncedAt: r.lastSyncedAt,
  }));
}
