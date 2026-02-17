import { z } from 'zod';

export interface LinearProviderData {
  provider: 'LINEAR';
  workspaceSlug?: string;
  /** ISO timestamp of most recently updated issue — filters subsequent syncs */
  lastIssueSyncedAt: string | null;
}

export const linearProviderDataSchema = z.object({
  provider: z.literal('LINEAR'),
  workspaceSlug: z.string().optional(),
  lastIssueSyncedAt: z.string().nullable(),
});

/** Public schema — same as internal (no sensitive fields to strip). */
export const linearPublicSchema = z.object({
  provider: z.literal('LINEAR'),
  workspaceSlug: z.string().optional(),
  lastIssueSyncedAt: z.string().nullable(),
});
