import { z } from 'zod';

// ---------------------------------------------------------------------------
// Provider data
// ---------------------------------------------------------------------------

/** Map of Slack channel ID to the latest message timestamp cursor. */
export type SlackChannelTimestamps = Record<string, string>;

export interface SlackProviderData {
  provider: 'SLACK';
  slackBotUserId?: string;
  teamDomain?: string;
  /** Last message timestamp per channel, used for incremental fetch */
  channelTimestamps: SlackChannelTimestamps;
  /** IDs of public channels the user selected for syncing */
  selectedChannels?: string[];
}

export const slackProviderDataSchema = z.object({
  provider: z.literal('SLACK'),
  slackBotUserId: z.string().optional(),
  teamDomain: z.string().optional(),
  channelTimestamps: z.record(z.string(), z.string()).default({}),
  selectedChannels: z.array(z.string()).optional(),
});

/** Public schema, same as full for Slack (no sensitive fields to strip). */
export const slackPublicSchema = z.object({
  provider: z.literal('SLACK'),
  slackBotUserId: z.string().optional(),
  teamDomain: z.string().optional(),
  channelTimestamps: z.record(z.string(), z.string()).default({}),
  selectedChannels: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Slack API response types
// ---------------------------------------------------------------------------

export interface SlackChannel {
  id: string;
  name: string;
  is_member: boolean;
  is_archived: boolean;
}

export interface SlackConversationsListResponse {
  ok: boolean;
  error?: string;
  channels?: SlackChannel[];
  response_metadata?: {
    next_cursor?: string;
  };
}

export interface SlackMessage {
  type: string;
  user?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  reply_count?: number;
  bot_id?: string;
}

export interface SlackConversationsHistoryResponse {
  ok: boolean;
  error?: string;
  messages?: SlackMessage[];
  has_more?: boolean;
  response_metadata?: {
    next_cursor?: string;
  };
}

export interface SlackConversationsRepliesResponse {
  ok: boolean;
  error?: string;
  messages?: SlackMessage[];
  has_more?: boolean;
  response_metadata?: {
    next_cursor?: string;
  };
}

export interface SlackUserInfoResponse {
  ok: boolean;
  error?: string;
  user?: {
    real_name?: string;
    profile?: { display_name?: string; real_name?: string };
  };
}

export interface SlackTokenResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  bot_user_id?: string;
  team?: {
    id?: string;
    name?: string;
  };
  scope?: string;
}

export interface SlackTeamInfoResponse {
  ok: boolean;
  error?: string;
  team?: {
    id?: string;
    name?: string;
    domain?: string;
  };
}

export const slackApiResponseSchema = z.object({ ok: z.boolean(), error: z.string().optional() });
