import { z } from 'zod';

import type { SyncedItem } from '../../connector.interface';

// ---------------------------------------------------------------------------
// Zod schema for Linear webhook payloads (trust boundary)
// ---------------------------------------------------------------------------

export const linearWebhookBodySchema = z.object({
  action: z.string().optional(),
  type: z.string().optional(),
  data: z
    .object({
      id: z.string().optional(),
      issueId: z.string().optional(),
    })
    .optional(),
  url: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export function formatLinearDate(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, ' UTC');
}

// ---------------------------------------------------------------------------
// Issue types
// ---------------------------------------------------------------------------

export interface IssueFields {
  id: string;
  identifier: string;
  title: string;
  description: string | undefined;
  url: string;
  updatedAt: Date;
  priority: number;
  priorityLabel: string;
  state: { name: string } | undefined;
  assignee: { name: string } | undefined;
  team: { name: string } | undefined;
  labels: { nodes: Array<{ name: string }> };
  parent: { identifier: string; title: string } | undefined;
  children: {
    nodes: Array<{ identifier: string; title: string; state: { name: string } | undefined }>;
  };
  comments: {
    nodes: Array<{
      id: string;
      body: string;
      user: { name: string } | undefined;
      createdAt: Date;
      url: string;
    }>;
  };
}

// ---------------------------------------------------------------------------
// Item builders
// ---------------------------------------------------------------------------

export function buildIssueContextHeader(issue: IssueFields): string {
  const lines: string[] = [];

  lines.push(`Issue ${issue.identifier}: ${issue.title}`);

  const statusParts: string[] = [];
  if (issue.state) statusParts.push(`Status: ${issue.state.name}`);
  if (issue.priorityLabel) statusParts.push(`Priority: ${issue.priorityLabel}`);
  if (issue.assignee) statusParts.push(`Assignee: ${issue.assignee.name}`);
  if (issue.team) statusParts.push(`Team: ${issue.team.name}`);
  if (statusParts.length > 0) lines.push(statusParts.join(' | '));

  const labelNames = issue.labels.nodes.map((l) => l.name);
  if (labelNames.length > 0) lines.push(`Labels: ${labelNames.join(', ')}`);

  if (issue.parent) {
    lines.push(`Parent: ${issue.parent.identifier} ${issue.parent.title}`);
  }

  if (issue.children.nodes.length > 0) {
    const childParts = issue.children.nodes.map(
      (c) => `${c.identifier} ${c.title}${c.state ? ` (${c.state.name})` : ''}`
    );
    lines.push(`Sub-issues: ${childParts.join(', ')}`);
  }

  return lines.join('\n');
}

export function buildCommentContextLine(issue: IssueFields): string {
  const parts = [`Comment on ${issue.identifier} (${issue.title})`];
  if (issue.state) parts.push(issue.state.name);
  if (issue.priorityLabel) parts.push(issue.priorityLabel);
  return parts.join(' | ');
}

export function buildSyncedItemFromIssue(issue: IssueFields): SyncedItem {
  const messages: NonNullable<SyncedItem['messages']> = [];
  const contextHeader = buildIssueContextHeader(issue);

  // Issue description (or header-only) as first message
  const descriptionContent = issue.description
    ? `${contextHeader}\n\n${issue.description}`
    : contextHeader;

  messages.push({
    content: descriptionContent,
    metadata: {
      type: 'LINEAR' as const,
      linearIssueId: issue.id,
      linearCommentId: null,
    },
    sourceUrl: issue.url,
  });

  // Each comment as a separate message with context line
  const commentContext = buildCommentContextLine(issue);
  for (const comment of issue.comments.nodes) {
    const author = comment.user?.name ?? 'Unknown';
    const time = formatLinearDate(comment.createdAt.toISOString());
    messages.push({
      content: `${commentContext}\n[${time}] ${author}: ${comment.body}`,
      metadata: {
        type: 'LINEAR' as const,
        linearIssueId: issue.id,
        linearCommentId: comment.id,
      },
      sourceUrl: comment.url,
    });
  }

  const content = messages.map((m) => m.content).join('\n\n');
  const labelNames = issue.labels.nodes.map((l) => l.name);

  return {
    externalId: issue.id,
    title: `[${issue.identifier}] ${issue.title}`,
    content,
    messages,
    sourceUrl: issue.url,
    metadata: {
      linearIssueId: issue.id,
      identifier: issue.identifier,
      commentCount: issue.comments.nodes.length,
      status: issue.state?.name ?? null,
      priority: issue.priorityLabel || null,
      assignee: issue.assignee?.name ?? null,
      team: issue.team?.name ?? null,
      labels: labelNames.length > 0 ? labelNames : null,
    },
  };
}
