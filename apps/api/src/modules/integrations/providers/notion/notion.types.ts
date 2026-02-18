import { z } from 'zod';

export interface NotionProviderData {
  provider: 'NOTION';
  workspaceName?: string;
  notionWorkspaceId?: string;
  /** ISO timestamp cursor — sync pages edited after this time. */
  lastSyncedAt: string | null;
}

export const notionProviderDataSchema = z.object({
  provider: z.literal('NOTION'),
  workspaceName: z.string().optional(),
  notionWorkspaceId: z.string().optional(),
  lastSyncedAt: z.string().nullable(),
});

/** Public schema — same as full for Notion (no sensitive fields to strip). */
export const notionPublicSchema = z.object({
  provider: z.literal('NOTION'),
  workspaceName: z.string().optional(),
  notionWorkspaceId: z.string().optional(),
  lastSyncedAt: z.string().nullable(),
});
