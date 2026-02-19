import type { RestEndpointMethodTypes } from '@octokit/rest';
import { z } from 'zod';

import type { SyncedItem } from '../../connector.interface';

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

export type GitHubItemType = 'issue' | 'pull_request' | 'discussion';
export type MessageList = NonNullable<SyncedItem['messages']>;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function formatGitHubDate(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, ' UTC');
}

export function buildContextHeader(opts: {
  repo: string;
  number: number;
  title: string;
  kind?: string;
  state?: string;
  author: string;
  labels: string[];
  assignees?: string[];
  branches?: { head: string; base: string };
}): string {
  const prefix = opts.kind ? ` (${opts.kind})` : '';
  const lines: string[] = [`${opts.repo}#${opts.number}${prefix}: ${opts.title}`];

  const parts: string[] = [];
  if (opts.state) parts.push(`State: ${opts.state}`);
  if (opts.author) parts.push(`Author: ${opts.author}`);
  if (opts.assignees && opts.assignees.length > 0)
    parts.push(`Assignees: ${opts.assignees.join(', ')}`);
  if (parts.length > 0) lines.push(parts.join(' | '));

  if (opts.branches) lines.push(`Branches: ${opts.branches.head} -> ${opts.branches.base}`);
  if (opts.labels.length > 0) lines.push(`Labels: ${opts.labels.join(', ')}`);

  return lines.join('\n');
}

export function buildSyncedItem(
  itemType: GitHubItemType,
  repo: string,
  number: number,
  title: string,
  sourceUrl: string,
  contextHeader: string,
  body: string | null | undefined,
  comments: MessageList,
  metadata: Record<string, unknown>
): SyncedItem {
  const descContent = body ? `${contextHeader}\n\n${body}` : contextHeader;
  const messages: MessageList = [
    {
      content: descContent,
      metadata: { type: 'GITHUB' as const, githubItemType: itemType, githubCommentId: null },
      sourceUrl,
    },
    ...comments,
  ];

  return {
    externalId: `${repo}#${number}`,
    title: `[${repo}#${number}] ${title}`,
    content: messages.map((m) => m.content).join('\n\n'),
    messages,
    sourceUrl,
    metadata: { githubItemType: itemType, repo, number, ...metadata },
  };
}

export function extractLabels(labels: Array<{ name?: string } | string>): string[] {
  return labels
    .map((l) => (typeof l === 'string' ? l : l.name))
    .filter((n): n is string => n !== undefined);
}

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

export function buildDiscussionItem(discussion: DiscussionNode, repoFullName: string): SyncedItem {
  const author = discussion.author?.login ?? 'unknown';
  const labels = (discussion.labels?.nodes ?? []).map((l) => l.name);
  const category = discussion.category?.name ?? '';

  const header = buildContextHeader({
    repo: repoFullName,
    number: discussion.number,
    title: discussion.title,
    kind: 'Discussion',
    author,
    labels,
  });
  // Insert category into the metadata line if present
  const contextHeader = category ? header.replace('\n', `\nCategory: ${category} | `) : header;

  const comments: MessageList = discussion.comments.nodes.map((c) => ({
    content: `Comment on ${repoFullName}#${discussion.number} Discussion (${discussion.title})\n[${formatGitHubDate(c.createdAt)}] ${c.author?.login ?? 'unknown'}: ${c.body}`,
    metadata: {
      type: 'GITHUB' as const,
      githubItemType: 'discussion' as const,
      githubCommentId: c.id,
    },
    sourceUrl: c.url,
  }));

  return buildSyncedItem(
    'discussion',
    repoFullName,
    discussion.number,
    discussion.title,
    discussion.url,
    contextHeader,
    discussion.body,
    comments,
    { category: category || null, labels: labels.length > 0 ? labels : null }
  );
}
