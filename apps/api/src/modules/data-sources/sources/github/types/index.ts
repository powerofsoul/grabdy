import type { RestEndpointMethodTypes } from '@octokit/rest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Provider data
// ---------------------------------------------------------------------------

export interface GitHubProviderData {
  provider: 'GITHUB';
  githubInstallationId: number;
  installationOwner?: string;
  selectedRepos?: string[];
  lastSyncedAt: string | null;
}

export const githubProviderDataSchema = z.object({
  provider: z.literal('GITHUB'),
  githubInstallationId: z.number(),
  installationOwner: z.string().optional(),
  selectedRepos: z.array(z.string()).optional(),
  lastSyncedAt: z.string().nullable(),
});

/** Public schema, strip internal githubInstallationId. */
export const githubPublicSchema = z.object({
  provider: z.literal('GITHUB'),
  installationOwner: z.string().optional(),
  selectedRepos: z.array(z.string()).optional(),
  lastSyncedAt: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Octokit response types (avoids inline type literals)
// ---------------------------------------------------------------------------

export type GitHubIssue =
  | RestEndpointMethodTypes['issues']['listForRepo']['response']['data'][number]
  | RestEndpointMethodTypes['issues']['get']['response']['data'];
export type GitHubPR =
  | RestEndpointMethodTypes['pulls']['list']['response']['data'][number]
  | RestEndpointMethodTypes['pulls']['get']['response']['data'];

// ---------------------------------------------------------------------------
// Zod schemas for GitHub webhook payloads (trust boundary)
// ---------------------------------------------------------------------------

const webhookNumberedItemSchema = z.object({ number: z.number() });
const webhookRepoSchema = z.object({ full_name: z.string() });
const webhookInstallationSchema = z.object({ id: z.number() });

export const webhookBasePayloadSchema = z.object({
  action: z.string().optional(),
  repository: webhookRepoSchema.optional(),
  installation: webhookInstallationSchema.optional(),
});

export const issueWebhookSchema = webhookBasePayloadSchema.extend({
  issue: webhookNumberedItemSchema,
});
export const prWebhookSchema = webhookBasePayloadSchema.extend({
  pull_request: webhookNumberedItemSchema.extend({
    merged: z.boolean().optional(),
  }),
});
export const discussionWebhookSchema = webhookBasePayloadSchema.extend({
  discussion: webhookNumberedItemSchema,
});

// ---------------------------------------------------------------------------
// Shared type aliases
// ---------------------------------------------------------------------------

import type { SyncedItem } from '../../../../integrations/connector.interface';

export type GitHubItemType = 'issue' | 'pull_request' | 'discussion';
export type MessageList = NonNullable<SyncedItem['messages']>;

// ---------------------------------------------------------------------------
// Discussion GraphQL types
// ---------------------------------------------------------------------------

export interface DiscussionNode {
  number: number;
  title: string;
  body: string;
  url: string;
  updatedAt: string;
  author: { login: string } | null;
  category: { name: string } | null;
  labels: { nodes: Array<{ name: string }> } | null;
  comments: {
    nodes: Array<{
      id: string;
      body: string;
      url: string;
      createdAt: string;
      author: { login: string } | null;
    }>;
  };
}

export const DISCUSSION_FIELDS = `
  number title body url updatedAt
  author { login }
  category { name }
  labels(first: 10) { nodes { name } }
  comments(first: 50) {
    nodes { id body url createdAt author { login } }
  }
`;
