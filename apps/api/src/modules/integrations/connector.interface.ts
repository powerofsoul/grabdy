import type { DbId } from '@grabdy/common';
import type { ChunkMeta, IntegrationProvider } from '@grabdy/contracts';
import { z } from 'zod';

import {
  type GitHubProviderData,
  githubProviderDataSchema,
  githubPublicSchema,
} from './providers/github/github.types';
import {
  type LinearProviderData,
  linearProviderDataSchema,
  linearPublicSchema,
} from './providers/linear/linear.types';
import {
  type SlackProviderData,
  slackProviderDataSchema,
  slackPublicSchema,
} from './providers/slack/slack.types';

export type { GitHubProviderData } from './providers/github/github.types';
export type { LinearProviderData } from './providers/linear/linear.types';
export type { SlackProviderData } from './providers/slack/slack.types';

// ---------------------------------------------------------------------------
// Per-provider data (discriminated union)
// ---------------------------------------------------------------------------

export type ProviderData = SlackProviderData | LinearProviderData | GitHubProviderData;

export type ProviderDataMap = {
  SLACK: SlackProviderData;
  LINEAR: LinearProviderData;
  GITHUB: GitHubProviderData;
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
  metadata: Record<string, unknown>;
}

export interface SyncResult {
  items: SyncedItem[];
  deletedExternalIds: string[];
  /** Updated provider data to persist (includes new sync cursors/timestamps). */
  updatedProviderData: ProviderData;
  hasMore: boolean;
}

export interface WebhookEvent {
  action: 'created' | 'updated' | 'deleted';
  externalId: string;
  data?: SyncedItem;
}

export interface WebhookHandlerResult {
  response: Record<string, unknown>;
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
]);

/** Parse raw JSONB provider_data from DB into typed ProviderData (trust boundary). */
export function parseProviderData(raw: unknown): ProviderData {
  return providerDataSchema.parse(raw);
}

const publicProviderDataSchema = z.discriminatedUnion('provider', [
  slackPublicSchema,
  linearPublicSchema,
  githubPublicSchema,
]);

export type PublicProviderData = z.infer<typeof publicProviderDataSchema>;

/** Strip internal-only fields for API response. */
export function parsePublicProviderData(raw: unknown): PublicProviderData {
  return publicProviderDataSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// Abstract connector
// ---------------------------------------------------------------------------

export abstract class IntegrationConnector<P extends IntegrationProvider = IntegrationProvider> {
  abstract readonly provider: P;
  abstract readonly rateLimits: RateLimitConfig;

  /** If non-null, the provider needs periodic full syncs. BullMQ repeat pattern (milliseconds). */
  abstract readonly syncSchedule: { every: number } | null;

  /** Custom system prompt prepended to the AI agent when responding via this integration. */
  readonly botInstructions: string | undefined = undefined;

  abstract getAuthUrl(orgId: DbId<'Org'>, state: string, redirectUri: string): string;
  abstract exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens<P>>;
  abstract refreshTokens(refreshToken: string): Promise<OAuthTokens<P>>;

  /** Fetch the connected account's ID and display name after OAuth. */
  abstract getAccountInfo(accessToken: string): Promise<AccountInfo<P>>;

  abstract parseWebhook(
    headers: Record<string, string>,
    body: unknown,
    secret: string | null,
    rawBody?: string
  ): WebhookEvent | null;

  abstract handleWebhookRequest(
    headers: Record<string, string>,
    body: unknown,
    connections: ReadonlyArray<{
      id: DbId<'Connection'>;
      orgId: DbId<'Org'>;
      providerData: ProviderDataMap[P];
    }>,
    rawBody?: string
  ): WebhookHandlerResult;

  abstract sync(accessToken: string, providerData: ProviderDataMap[P]): Promise<SyncResult>;

  /** Process a single webhook event item (fetch + build SyncedItem). */
  abstract processWebhookItem(
    accessToken: string,
    providerData: ProviderDataMap[P],
    event: WebhookEvent
  ): Promise<{ item: SyncedItem | null; deletedExternalId: string | null }>;

  /** Build initial provider data from OAuth + account metadata after first connection. */
  abstract buildInitialProviderData(
    tokenMetadata?: Partial<ProviderDataMap[P]>,
    accountMetadata?: Partial<ProviderDataMap[P]>
  ): ProviderDataMap[P];
}
