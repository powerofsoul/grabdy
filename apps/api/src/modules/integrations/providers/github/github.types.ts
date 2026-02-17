import { z } from 'zod';

export interface GitHubProviderData {
  provider: 'GITHUB';
  githubInstallationId: number;
  installationOwner?: string;
  lastSyncedAt: string | null;
}

export const githubProviderDataSchema = z.object({
  provider: z.literal('GITHUB'),
  githubInstallationId: z.number(),
  installationOwner: z.string().optional(),
  lastSyncedAt: z.string().nullable(),
});

/** Public schema — strip internal githubInstallationId. */
export const githubPublicSchema = z.object({
  provider: z.literal('GITHUB'),
  installationOwner: z.string().optional(),
  lastSyncedAt: z.string().nullable(),
});
