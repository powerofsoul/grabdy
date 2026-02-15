import type { DbId } from '@grabdy/common';
import type { ChunkMeta, IntegrationProvider } from '@grabdy/contracts';

// ---------------------------------------------------------------------------
// Per-provider connection config (discriminated by provider field)
// ---------------------------------------------------------------------------

export interface SlackConnectionConfig {
  botUserId?: string;
  teamDomain?: string;
  [key: string]: unknown;
}

export type ConnectionConfigMap = {
  SLACK: SlackConnectionConfig;
};

export type ConnectionConfig = ConnectionConfigMap[IntegrationProvider];

/** Narrow a connection config to a specific provider's type. */
export function connectionConfig<P extends IntegrationProvider>(
  _provider: P,
  config: ConnectionConfig
): ConnectionConfigMap[P] {
  return config satisfies ConnectionConfigMap[P];
}

// ---------------------------------------------------------------------------
// OAuth & Account info
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
}

export interface OAuthTokens<P extends IntegrationProvider = IntegrationProvider> {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string[];
  /** Provider-specific metadata stored in connection config. */
  metadata?: ConnectionConfigMap[P];
}

export interface AccountInfo<P extends IntegrationProvider = IntegrationProvider> {
  id: string;
  name: string;
  /** Provider-specific metadata to store in connection config. */
  metadata?: ConnectionConfigMap[P];
}

export interface SyncedItem {
  externalId: string;
  title: string;
  content: string;
  /** Structured messages with per-message metadata and source URL (one chunk per message). */
  messages?: Array<{ content: string; metadata: ChunkMeta; sourceUrl: string | null }>;
  /** URL for the data source (e.g., channel URL). Stored on data_sources, not chunks. */
  sourceUrl: string | null;
  metadata: Record<string, unknown>;
}

export interface SyncCursor {
  [key: string]: unknown;
}

export interface SyncResult {
  items: SyncedItem[];
  deletedExternalIds: string[];
  cursor: SyncCursor | null;
  hasMore: boolean;
}

export interface SyncLogDetails {
  /** Names of items synced during this sync run. */
  items: string[];
}

export interface WebhookInfo {
  webhookRef: string;
  secret: string | null;
}

export interface WebhookEvent {
  action: 'created' | 'updated' | 'deleted';
  externalId: string;
  data?: SyncedItem;
}

export abstract class IntegrationConnector<P extends IntegrationProvider = IntegrationProvider> {
  abstract readonly provider: P;
  abstract readonly rateLimits: RateLimitConfig;
  abstract readonly supportsWebhooks: boolean;

  /** Custom system prompt prepended to the AI agent when responding via this integration. */
  readonly botInstructions: string | undefined = undefined;

  abstract getAuthUrl(orgId: DbId<'Org'>, state: string, redirectUri: string): string;
  abstract exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens<P>>;
  abstract refreshTokens(refreshToken: string): Promise<OAuthTokens<P>>;

  /** Fetch the connected account's ID and display name after OAuth. */
  abstract getAccountInfo(accessToken: string): Promise<AccountInfo<P>>;

  abstract registerWebhook(
    accessToken: string,
    config: ConnectionConfigMap[P]
  ): Promise<WebhookInfo | null>;
  abstract deregisterWebhook(accessToken: string, webhookRef: string): Promise<void>;
  abstract parseWebhook(
    headers: Record<string, string>,
    body: unknown,
    secret: string | null,
    rawBody?: string
  ): WebhookEvent | null;

  abstract sync(
    accessToken: string,
    config: ConnectionConfigMap[P],
    cursor: SyncCursor | null
  ): Promise<SyncResult>;
}
