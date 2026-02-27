import { z } from 'zod';

// ---------------------------------------------------------------------------
// Provider data
// ---------------------------------------------------------------------------

export interface LinearProviderData {
  provider: 'LINEAR';
  workspaceSlug?: string;
  /** ISO timestamp of most recently updated issue, filters subsequent syncs */
  lastIssueSyncedAt: string | null;
}

export const linearProviderDataSchema = z.object({
  provider: z.literal('LINEAR'),
  workspaceSlug: z.string().optional(),
  lastIssueSyncedAt: z.string().nullable(),
});

/** Public schema, same as internal (no sensitive fields to strip). */
export const linearPublicSchema = z.object({
  provider: z.literal('LINEAR'),
  workspaceSlug: z.string().optional(),
  lastIssueSyncedAt: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Webhook payload schemas (trust boundary)
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
