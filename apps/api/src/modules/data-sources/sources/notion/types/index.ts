import { z } from 'zod';

// ---------------------------------------------------------------------------
// Provider data
// ---------------------------------------------------------------------------

export interface NotionProviderData {
  provider: 'NOTION';
  workspaceName?: string;
  notionWorkspaceId?: string;
  /** ISO timestamp cursor, sync pages edited after this time. */
  lastSyncedAt: string | null;
}

export const notionProviderDataSchema = z.object({
  provider: z.literal('NOTION'),
  workspaceName: z.string().optional(),
  notionWorkspaceId: z.string().optional(),
  lastSyncedAt: z.string().nullable(),
});

/** Public schema, same as full for Notion (no sensitive fields to strip). */
export const notionPublicSchema = z.object({
  provider: z.literal('NOTION'),
  workspaceName: z.string().optional(),
  notionWorkspaceId: z.string().optional(),
  lastSyncedAt: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// OAuth token response schema (trust boundary)
// ---------------------------------------------------------------------------

export const notionTokenResponseSchema = z.object({
  access_token: z.string(),
  workspace_id: z.string(),
  workspace_name: z.string(),
});

// ---------------------------------------------------------------------------
// Webhook payload schemas (trust boundary)
// ---------------------------------------------------------------------------

const notionWebhookEntitySchema = z.object({
  id: z.string(),
  type: z.enum(['page', 'database']),
});

export const notionWebhookPayloadSchema = z.object({
  type: z.string(),
  entity: notionWebhookEntitySchema.optional(),
});

// ---------------------------------------------------------------------------
// Page parsing schemas (trust boundary)
// ---------------------------------------------------------------------------

export const notionPageSchema = z.object({ object: z.string(), id: z.string() }).passthrough();

export const notionDbTitleSchema = z.object({
  title: z.array(z.object({ plain_text: z.string() })),
});

export const notionPropertiesSchema = z.object({ properties: z.unknown() });

export const notionTitlePropertySchema = z.object({
  type: z.literal('title'),
  title: z.array(z.object({ plain_text: z.string() })),
});
