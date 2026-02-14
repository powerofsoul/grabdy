import type { DbId } from '@grabdy/common';

import type { IntegrationProvider } from '../../db/enums';

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string[];
}

export interface AccountInfo {
  id: string;
  name: string;
}

export interface SyncedItem {
  externalId: string;
  title: string;
  content: string;
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

export interface WebhookInfo {
  webhookRef: string;
  secret: string | null;
}

export interface WebhookEvent {
  action: 'created' | 'updated' | 'deleted';
  externalId: string;
  data?: SyncedItem;
}

export abstract class IntegrationConnector {
  abstract readonly provider: IntegrationProvider;
  abstract readonly rateLimits: RateLimitConfig;
  abstract readonly supportsWebhooks: boolean;

  abstract getAuthUrl(orgId: DbId<'Org'>, state: string, redirectUri: string): string;
  abstract exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>;
  abstract refreshTokens(refreshToken: string): Promise<OAuthTokens>;

  /** Fetch the connected account's ID and display name after OAuth. */
  abstract getAccountInfo(accessToken: string): Promise<AccountInfo>;

  abstract registerWebhook(
    accessToken: string,
    config: Record<string, unknown>,
  ): Promise<WebhookInfo | null>;
  abstract deregisterWebhook(accessToken: string, webhookRef: string): Promise<void>;
  abstract parseWebhook(
    headers: Record<string, string>,
    body: unknown,
    secret: string | null,
  ): WebhookEvent | null;

  abstract sync(
    accessToken: string,
    config: Record<string, unknown>,
    cursor: SyncCursor | null,
  ): Promise<SyncResult>;
}
