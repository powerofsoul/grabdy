import type { ChunkMeta } from '@grabdy/contracts';

import type { SyncedItem } from '../../../../integrations/connector.interface';
import type { DiscussionNode, GitHubItemType, MessageList } from '../types';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function parseGitHubExternalId(
  externalId: string
): { owner: string; repoName: string; repoFullName: string; number: number } | null {
  const match = /^(.+?)\/(.+?)#(\d+)$/.exec(externalId);
  if (!match) return null;
  const [, owner, repoName, numStr] = match;
  return { owner, repoName, repoFullName: `${owner}/${repoName}`, number: parseInt(numStr, 10) };
}

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
  metadata: SyncedItem['metadata']
): SyncedItem {
  const descContent = body ? `${contextHeader}\n\n${body}` : contextHeader;
  const messages: MessageList = [
    {
      content: descContent,
      metadata: {
        type: 'GITHUB',
        githubItemType: itemType,
        githubCommentId: null,
      } satisfies ChunkMeta,
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
      type: 'GITHUB',
      githubItemType: 'discussion',
      githubCommentId: c.id,
    } satisfies ChunkMeta,
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
