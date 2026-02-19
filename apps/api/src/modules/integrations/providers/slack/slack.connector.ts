import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { IntegrationProvider } from '@grabdy/contracts';
import { createHmac, timingSafeEqual } from 'crypto';

import { InjectEnv } from '../../../../config/env.config';
import {
  type AccountInfo,
  IntegrationConnector,
  type OAuthTokens,
  type RateLimitConfig,
  type SyncedItem,
  type SyncResult,
  type WebhookEvent,
  type WebhookHandlerResult,
} from '../../connector.interface';

import { SlackBotService } from './slack-bot.service';
import type { SlackProviderData } from './slack.types';
import { SlackChannelWebhook } from './webhooks/channel.webhook';

const SLACK_AUTH_URL = 'https://slack.com/oauth/v2/authorize';
const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
const SLACK_API_URL = 'https://slack.com/api';
const SLACK_SCOPES =
  'channels:history,channels:read,channels:join,users:read,team:read,app_mentions:read,chat:write,im:history,im:read';

// --- Slack API response types ---

interface SlackTokenResponse {
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

interface SlackTeamInfoResponse {
  ok: boolean;
  error?: string;
  team?: {
    id?: string;
    name?: string;
    domain?: string;
  };
}

interface SlackChannel {
  id: string;
  name: string;
  is_member: boolean;
  is_archived: boolean;
}

interface SlackConversationsListResponse {
  ok: boolean;
  error?: string;
  channels?: SlackChannel[];
  response_metadata?: {
    next_cursor?: string;
  };
}

@Injectable()
export class SlackConnector extends IntegrationConnector<'SLACK'> {
  readonly provider = IntegrationProvider.SLACK;
  readonly rateLimits: RateLimitConfig = {
    maxRequestsPerMinute: 50,
    maxRequestsPerHour: 3000,
  };
  readonly syncSchedule = { every: 3_600_000 }; // 1 hour

  readonly botInstructions = `You are a Slack bot. Be helpful and conversational but brief — this is Slack, not a document.

Keep answers under 2000 characters. For complex topics, give the key insight and offer to elaborate.

Use 1-2 searches, max 3 for complex multi-part questions.

Use Slack mrkdwn only: *bold*, _italic_, \`code\`, > quotes, • bullets. Do NOT use markdown **bold**, # headings, or [links](url).

Do NOT mention confidence scores, relevance levels, or "limited matches". Just answer naturally.

Do NOT start with preamble like "Here's what I found about...", "Based on the knowledge base...", or "I found reports about...". Jump straight into the answer.

## CRITICAL: Always Answer, Never Ask

NEVER ask clarification questions. NEVER say "could you clarify?" or "what do you mean by...?" or "which X are you referring to?". Your job is to search the data and give the best answer you can.

- If a question is ambiguous, search for ALL possible interpretations and present what you find.
- If a question is broad, give the most relevant information from the data.
- If results are sparse or low-relevance, still share whatever you found — the user can decide if it's useful.
- NEVER say "I couldn't find information" without first trying at least 2-3 different search queries with varied keywords.
- NEVER respond with just a greeting or pleasantry. If the user says "hi, what's the status of project X?", skip the greeting and answer about project X.
- ALWAYS search first, answer second. Default to action, not conversation.

## Answer format

Write a short, conversational summary that directly answers the question. Then add a blank line and list sources.

## CRITICAL: Sources Are Mandatory

Every answer MUST end with source links. NEVER skip sources. If you used data from a search result, you MUST cite it.

For each search result, the tool returns \`sourceUrl\` and \`metadata\` (with fields like slackAuthor, pages, sheet, linearIssueId, etc.). Use these to build source links.

Source format rules:
- ALWAYS use the \`sourceUrl\` field from search results to create clickable Slack links: \`<sourceUrl|Label>\`
- If there is only ONE source of a given type, use just the type name: Slack, Linear, PDF, Notion, GitHub, etc. Only add numbers (Slack 1, Slack 2) when there are MULTIPLE sources of the same type.
- For Slack sources: \`<sourceUrl|Slack>\` — <@slackAuthor> (use the slackAuthor from metadata)
- For Linear sources: \`<sourceUrl|Linear>\`
- For PDF/DOCX sources: \`<sourceUrl|PDF>\` (add page info if metadata has pages, e.g. "PDF p.3")
- For XLSX/CSV sources: \`<sourceUrl|XLSX>\` (add sheet/row info if available)
- For Notion sources: \`<sourceUrl|Notion>\`
- For GitHub sources: \`<sourceUrl|GitHub>\`
- If sourceUrl is null or empty, use \`dataSourceName\` as plain text (no link).
- Keep the link display text SHORT. Never put long text inside the <url|text> link.
- Deduplicate: if multiple chunks come from the same sourceUrl, list it only once.

Example answer:
Users have reported they can't access the chat feature. A workaround is to type /doctor which fixes it for 10 minutes.

<https://team.slack.com/archives/C123/p456|Slack> — <@U0ABC>
<https://linear.app/team/GRA-7|Linear>

## Replying

You MUST use the slack_reply tool to respond. Do NOT output a plain text answer.

1. IMMEDIATELY call slack_reply with a brief status (e.g. ":mag: Looking that up...")
2. Do your first rag-search
3. If you need more searches, call slack_reply with a progress update (e.g. ":mag: Searching for more details..." or ":mag: Checking related topics...") so the user knows you're still working
4. Call slack_reply with your complete answer — this updates the same message

The user sees one message that evolves from "searching..." → "digging deeper..." → the final answer. Always keep the user informed that something is happening.`;

  private readonly logger = new Logger(SlackConnector.name);

  constructor(
    @InjectEnv('slackClientId') private readonly oauthClient: string,
    @InjectEnv('slackClientSecret') private readonly clientSecret: string,
    @InjectEnv('slackSigningSecret') private readonly signingSecret: string,
    private readonly slackBotService: SlackBotService,
    private readonly channelWebhook: SlackChannelWebhook
  ) {
    super();
  }

  getAuthUrl(_orgId: DbId<'Org'>, state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.oauthClient,
      redirect_uri: redirectUri,
      scope: SLACK_SCOPES,
      state,
    });
    return `${SLACK_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens<'SLACK'>> {
    const response = await fetch(SLACK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.oauthClient,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    const data: SlackTokenResponse = await response.json();

    if (!data.ok || !data.access_token) {
      throw new Error(`Slack OAuth error: ${data.error ?? 'Unknown error'}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: null, // Slack bot tokens don't expire
      expiresAt: null,
      scopes: data.scope ? data.scope.split(',') : SLACK_SCOPES.split(','),
      metadata: data.bot_user_id ? { slackBotUserId: data.bot_user_id } : undefined,
    };
  }

  async refreshTokens(_refreshToken: string): Promise<OAuthTokens<'SLACK'>> {
    // Slack bot tokens don't expire and cannot be refreshed
    throw new Error('Slack bot tokens do not expire and cannot be refreshed');
  }

  async getAccountInfo(accessToken: string): Promise<AccountInfo<'SLACK'>> {
    const response = await fetch(`${SLACK_API_URL}/team.info`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data: SlackTeamInfoResponse = await response.json();

    if (!data.ok || !data.team) {
      throw new Error(`Slack team.info error: ${data.error ?? 'Unknown error'}`);
    }

    const teamId = data.team.id;
    const teamName = data.team.name;

    if (!teamId || !teamName) {
      throw new Error('Slack team.info returned incomplete team data');
    }

    return {
      id: teamId,
      name: teamName,
      metadata: data.team.domain ? { teamDomain: data.team.domain } : undefined,
    };
  }

  // ---- Webhooks ------------------------------------------------------------

  handleWebhookRequest(
    headers: Record<string, string>,
    body: unknown,
    connections: ReadonlyArray<{
      id: DbId<'Connection'>;
      orgId: DbId<'Org'>;
      providerData: SlackProviderData;
    }>,
    rawBody?: string
  ): WebhookHandlerResult {
    // Handle url_verification before anything else (Slack requires immediate response)
    if (
      typeof body === 'object' &&
      body !== null &&
      'type' in body &&
      body.type === 'url_verification' &&
      'challenge' in body
    ) {
      return { response: { challenge: body.challenge } };
    }

    // Delegate bot events (app_mention, member_joined, DM) to SlackBotService
    const botResult = this.slackBotService.handleWebhook(headers, body, connections, rawBody);
    if (botResult.handled) {
      return { response: { ok: true } };
    }

    // Non-bot events are acknowledged but no incremental sync is performed
    return { response: { ok: true } };
  }

  parseWebhook(
    headers: Record<string, string>,
    body: unknown,
    _secret: string | null,
    rawBody?: string
  ): WebhookEvent | null {
    if (!body || typeof body !== 'object') return null;

    if (!this.verifySignature(headers, rawBody ?? JSON.stringify(body))) return null;

    return this.channelWebhook.extractEvent(body);
  }

  // ---- Sync ----------------------------------------------------------------

  async sync(accessToken: string, providerData: SlackProviderData): Promise<SyncResult> {
    // Auto-join selected channels before fetching messages
    const selectedIds = providerData.selectedChannelIds ?? [];
    for (const channelId of selectedIds) {
      await this.joinChannel(accessToken, channelId);
    }

    const result = await this.channelWebhook.fetchUpdatedItems(accessToken, providerData);

    return {
      items: result.items,
      deletedExternalIds: [],
      updatedProviderData: {
        ...providerData,
        channelTimestamps: result.newTimestamps,
      },
      hasMore: false,
    };
  }

  async processWebhookItem(
    _accessToken: string,
    _providerData: SlackProviderData,
    _event: WebhookEvent
  ): Promise<{ item: SyncedItem | null; deletedExternalId: string | null }> {
    // Slack doesn't do incremental webhook sync — it uses hourly full sync
    return { item: null, deletedExternalId: null };
  }

  buildInitialProviderData(
    tokenMetadata?: Partial<SlackProviderData>,
    accountMetadata?: Partial<SlackProviderData>
  ): SlackProviderData {
    return {
      provider: 'SLACK',
      slackBotUserId: tokenMetadata?.slackBotUserId ?? accountMetadata?.slackBotUserId,
      teamDomain: tokenMetadata?.teamDomain ?? accountMetadata?.teamDomain,
      channelTimestamps: {},
    };
  }

  async listResources(
    accessToken: string,
    providerData: SlackProviderData
  ): Promise<Array<{ id: string; name: string; selected: boolean }>> {
    const selectedIds = new Set(providerData.selectedChannelIds ?? []);
    const channels = await this.fetchAllPublicChannels(accessToken);
    return channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      selected: selectedIds.has(ch.id),
    }));
  }

  // ---- Private: channel management ----------------------------------------

  private async joinChannel(accessToken: string, slackChannelId: string): Promise<void> {
    const response = await fetch(`${SLACK_API_URL}/conversations.join`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel: slackChannelId }),
    });
    const data: { ok: boolean; error?: string } = await response.json();
    if (!data.ok && data.error !== 'already_in_channel') {
      this.logger.warn(`Failed to join channel ${slackChannelId}: ${data.error ?? 'Unknown'}`);
    }
  }

  /** Fetch ALL non-archived public channels (regardless of membership). */
  private async fetchAllPublicChannels(accessToken: string): Promise<SlackChannel[]> {
    const channels: SlackChannel[] = [];
    let nextCursor: string | undefined;

    do {
      const params = new URLSearchParams({
        types: 'public_channel',
        exclude_archived: 'true',
        limit: '200',
      });
      if (nextCursor) {
        params.set('cursor', nextCursor);
      }

      const response = await fetch(`${SLACK_API_URL}/conversations.list?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data: SlackConversationsListResponse = await response.json();

      if (!data.ok) {
        throw new Error(`Slack conversations.list error: ${data.error ?? 'Unknown error'}`);
      }

      if (data.channels) {
        channels.push(...data.channels);
      }

      nextCursor = data.response_metadata?.next_cursor || undefined;
    } while (nextCursor);

    return channels;
  }

  // ---- Private: signature verification ------------------------------------

  private verifySignature(headers: Record<string, string>, bodyString: string): boolean {
    const timestamp = headers['x-slack-request-timestamp'];
    const signature = headers['x-slack-signature'];

    if (!timestamp || !signature) return false;

    // Prevent replay attacks (5 min window)
    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts) || Math.abs(now - ts) > 300) return false;

    const sigBasestring = `v0:${timestamp}:${bodyString}`;
    const expectedSignature = `v0=${createHmac('sha256', this.signingSecret).update(sigBasestring).digest('hex')}`;

    // Timing-safe comparison
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    return sigBuffer.length === expectedBuffer.length && timingSafeEqual(sigBuffer, expectedBuffer);
  }
}
