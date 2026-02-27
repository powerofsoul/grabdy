import type { DbId } from '@grabdy/common';
import type { ChunkMeta, IntegrationProvider } from '@grabdy/contracts';
import { z } from 'zod';

import {
  type GitHubProviderData,
  githubProviderDataSchema,
  githubPublicSchema,
} from '../data-sources/sources/github/types';
import {
  type LinearProviderData,
  linearProviderDataSchema,
  linearPublicSchema,
} from '../data-sources/sources/linear/types';
import {
  type NotionProviderData,
  notionProviderDataSchema,
  notionPublicSchema,
} from '../data-sources/sources/notion/types';
import {
  type SlackProviderData,
  slackProviderDataSchema,
  slackPublicSchema,
} from '../data-sources/sources/slack/types';

// ---------------------------------------------------------------------------
// Per-provider data (discriminated union)
// ---------------------------------------------------------------------------

export type ProviderData =
  | SlackProviderData
  | LinearProviderData
  | GitHubProviderData
  | NotionProviderData;

export type ProviderDataMap = {
  SLACK: SlackProviderData;
  LINEAR: LinearProviderData;
  GITHUB: GitHubProviderData;
  NOTION: NotionProviderData;
};

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
  /** Provider-specific metadata stored in provider data. */
  metadata?: Partial<ProviderDataMap[P]>;
}

export interface AccountInfo<P extends IntegrationProvider = IntegrationProvider> {
  id: string;
  name: string;
  /** Provider-specific metadata to store in provider data. */
  metadata?: Partial<ProviderDataMap[P]>;
}

export interface SyncedItem {
  externalId: string;
  title: string;
  content: string;
  /** Structured messages with per-message metadata and source URL (one chunk per message). */
  messages?: Array<{ content: string; metadata: ChunkMeta; sourceUrl: string }>;
  /** URL for the data source (e.g., channel URL). Stored on data_sources, not chunks. */
  sourceUrl: string;
  metadata: Record<string, string | number | boolean | string[] | null>;
  /** When true, new chunks are appended to existing data source without deleting old ones. */
  appendOnly?: boolean;
}

export interface ItemSyncResult {
  type: 'items';
  items: SyncedItem[];
  deletedExternalIds: string[];
  /** Updated provider data to persist (includes new sync cursors/timestamps). */
  updatedProviderData: ProviderData;
  hasMore: boolean;
}

export interface EventSyncResult {
  type: 'events';
  events: WebhookEvent[];
  deletedExternalIds: string[];
  /** Updated provider data to persist (includes new sync cursors/timestamps). */
  updatedProviderData: ProviderData;
}

export type SyncResult = ItemSyncResult | EventSyncResult;

export interface WebhookEvent {
  action: 'created' | 'updated' | 'deleted';
  externalId: string;
  eventType?: string;
  data?: SyncedItem;
}

export interface WebhookHandlerResult {
  response: { ok: boolean };
  syncConnections?: Array<{ id: DbId<'Connection'>; orgId: DbId<'Org'>; event: WebhookEvent }>;
  /** Connections to mark as disconnected (e.g. app uninstalled). */
  disconnectConnections?: Array<{ id: DbId<'Connection'>; orgId: DbId<'Org'> }>;
}

// ---------------------------------------------------------------------------
// Zod schemas for parsing raw provider_data JSONB from DB (trust boundary)
// ---------------------------------------------------------------------------

export const providerDataSchema = z.discriminatedUnion('provider', [
  slackProviderDataSchema,
  linearProviderDataSchema,
  githubProviderDataSchema,
  notionProviderDataSchema,
]);

/** Parse raw JSONB provider_data from DB into typed ProviderData (trust boundary). */
export function parseProviderData(raw: unknown): ProviderData {
  return providerDataSchema.parse(raw);
}

const publicProviderDataSchema = z.discriminatedUnion('provider', [
  slackPublicSchema,
  linearPublicSchema,
  githubPublicSchema,
  notionPublicSchema,
]);

export type PublicProviderData = z.infer<typeof publicProviderDataSchema>;

/** Strip internal-only fields for API response. */
export function parsePublicProviderData(raw: unknown): PublicProviderData {
  return publicProviderDataSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// Service interfaces
// ---------------------------------------------------------------------------

export interface IntegrationOAuth<P extends IntegrationProvider = IntegrationProvider> {
  getAuthUrl(orgId: DbId<'Org'>, state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens<P>>;
  refreshTokens(refreshToken: string): Promise<OAuthTokens<P>>;
  getAccountInfo(accessToken: string): Promise<AccountInfo<P>>;
  buildInitialProviderData(
    tokenMetadata?: Partial<ProviderDataMap[P]>,
    accountMetadata?: Partial<ProviderDataMap[P]>
  ): ProviderDataMap[P];
  revoke(accessToken: string, providerData: ProviderDataMap[P]): Promise<void>;
  listResources?(
    accessToken: string,
    providerData: ProviderDataMap[P]
  ): Promise<Array<{ id: string; name: string; selected: boolean }>>;
}

export interface IntegrationWebhook<P extends IntegrationProvider = IntegrationProvider> {
  verify(headers: Record<string, string>, body: unknown, rawBody?: string): boolean;
  handleEvent(
    headers: Record<string, string>,
    body: unknown,
    connections: ReadonlyArray<{
      id: DbId<'Connection'>;
      orgId: DbId<'Org'>;
      providerData: ProviderDataMap[P];
    }>,
    rawBody?: string
  ): WebhookHandlerResult;
  fetchItem(
    accessToken: string,
    providerData: ProviderDataMap[P],
    event: WebhookEvent
  ): Promise<{ item: SyncedItem | null; deletedExternalId: string | null }>;
}

export interface IntegrationSync<P extends IntegrationProvider = IntegrationProvider> {
  sync(
    accessToken: string,
    providerData: ProviderDataMap[P],
    context: { connectionId: DbId<'Connection'>; orgId: DbId<'Org'> }
  ): Promise<SyncResult>;
}

export interface ProviderConfig<P extends IntegrationProvider = IntegrationProvider> {
  oauth: IntegrationOAuth<P>;
  webhook: IntegrationWebhook<P>;
  sync: IntegrationSync<P>;
  syncSchedule: { every: number } | null;
  rateLimits: RateLimitConfig;
}
