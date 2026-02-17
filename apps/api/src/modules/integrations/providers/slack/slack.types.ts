import { z } from 'zod';

export interface SlackProviderData {
  provider: 'SLACK';
  slackBotUserId?: string;
  teamDomain?: string;
  /** Last message timestamp per channel — used for incremental fetch */
  channelTimestamps: Record<string, string>;
  /** IDs of public channels the user selected for syncing */
  selectedChannelIds?: string[];
}

export const slackProviderDataSchema = z.object({
  provider: z.literal('SLACK'),
  slackBotUserId: z.string().optional(),
  teamDomain: z.string().optional(),
  channelTimestamps: z.record(z.string(), z.string()).default({}),
  selectedChannelIds: z.array(z.string()).optional(),
});

/** Public schema — same as full for Slack (no sensitive fields to strip). */
export const slackPublicSchema = z.object({
  provider: z.literal('SLACK'),
  slackBotUserId: z.string().optional(),
  teamDomain: z.string().optional(),
  channelTimestamps: z.record(z.string(), z.string()).default({}),
  selectedChannelIds: z.array(z.string()).optional(),
});
