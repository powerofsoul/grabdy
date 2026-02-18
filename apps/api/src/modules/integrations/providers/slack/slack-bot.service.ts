import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { Queue } from 'bullmq';
import { createHmac, timingSafeEqual } from 'crypto';

import { InjectEnv } from '../../../../config/env.config';
import { SLACK_BOT_QUEUE } from '../../../queue/queue.constants';
import type { SlackProviderData } from './slack.types';

export interface SlackBotJobData {
  type: 'app_mention' | 'channel_joined' | 'dm';
  connectionId: DbId<'Connection'>;
  orgId: DbId<'Org'>;
  slackChannelId: string;
  /** Thread timestamp — bot replies in a thread under the mention. */
  threadTs?: string;
  /** The user's question text with @mention stripped. */
  text?: string;
}

interface SlackEventBody {
  type?: string;
  challenge?: string;
  team_id?: string;
  event?: {
    type?: string;
    channel?: string;
    channel_type?: string;
    text?: string;
    ts?: string;
    thread_ts?: string;
    user?: string;
    subtype?: string;
    bot_id?: string;
  };
}

function isSlackEventBody(body: unknown): body is SlackEventBody {
  return typeof body === 'object' && body !== null;
}

export type SlackWebhookResult = { handled: true; challenge?: string } | { handled: false };

@Injectable()
export class SlackBotService {
  private readonly logger = new Logger(SlackBotService.name);

  constructor(
    @InjectEnv('slackSigningSecret') private readonly signingSecret: string,
    @InjectQueue(SLACK_BOT_QUEUE) private readonly botQueue: Queue
  ) {}

  /**
   * Handle an incoming Slack Events API request.
   * Returns `{ handled: true }` if the event was processed (or is url_verification),
   * or `{ handled: false }` if it should fall through to normal sync handling.
   */
  handleWebhook(
    headers: Record<string, string>,
    body: unknown,
    connections: ReadonlyArray<{
      id: DbId<'Connection'>;
      orgId: DbId<'Org'>;
      providerData: SlackProviderData;
    }>,
    rawBody?: string
  ): SlackWebhookResult {
    if (!isSlackEventBody(body)) return { handled: false };

    // URL verification (no signature check needed — Slack sends this during setup)
    if (body.type === 'url_verification' && body.challenge) {
      return { handled: true, challenge: body.challenge };
    }

    // Verify signature using raw body for exact match
    if (!this.verifySignature(headers, rawBody ?? body)) {
      this.logger.warn('Slack webhook signature verification failed');
      return { handled: false };
    }

    const event = body.event;
    if (!event || !event.type) {
      this.logger.log(
        `Slack webhook has no event or event.type, body type: ${body.type ?? 'none'}`
      );
      return { handled: false };
    }

    this.logger.log(
      `Slack webhook event: ${event.type}, channel_type: ${event.channel_type ?? 'none'}`
    );

    if (event.type === 'app_mention') {
      this.handleAppMention(event, connections);
      return { handled: true };
    }

    if (event.type === 'member_joined_channel') {
      this.handleMemberJoined(event, connections);
      return { handled: true };
    }

    // DM messages: channel_type "im" with no subtype and no bot_id (avoid loops)
    if (
      event.type === 'message' &&
      event.channel_type === 'im' &&
      !event.subtype &&
      !event.bot_id
    ) {
      this.handleDirectMessage(event, connections);
      return { handled: true };
    }

    // Not a bot event — let the controller handle it as a normal sync webhook
    return { handled: false };
  }

  private verifySignature(headers: Record<string, string>, body: unknown): boolean {
    const timestamp = headers['x-slack-request-timestamp'];
    const signature = headers['x-slack-signature'];

    if (!timestamp || !signature) return false;

    const now = Math.floor(Date.now() / 1000);
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts) || Math.abs(now - ts) > 300) return false;

    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const sigBasestring = `v0:${timestamp}:${bodyString}`;
    const expectedSignature = `v0=${createHmac('sha256', this.signingSecret).update(sigBasestring).digest('hex')}`;

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      return false;
    }
    return true;
  }

  private handleAppMention(
    event: NonNullable<SlackEventBody['event']>,
    connections: ReadonlyArray<{
      id: DbId<'Connection'>;
      orgId: DbId<'Org'>;
      providerData: SlackProviderData;
    }>
  ): void {
    const slackChannelId = event.channel;
    const ts = event.ts;
    let text = event.text ?? '';

    if (!slackChannelId || !ts) return;

    // Strip @mention prefix from text (e.g. "<@U123ABC> what is X?" → "what is X?")
    // We strip all <@Uxxxxx> mentions since the primary one is the bot
    text = text.replace(/<@[A-Z0-9]+>/g, '').trim();

    if (!text) return;

    // Use the parent thread_ts if this mention is in a thread, otherwise use ts to start a new thread
    const threadTs = event.thread_ts ?? ts;

    // Queue a bot response job for each matching connection
    for (const conn of connections) {
      const jobData: SlackBotJobData = {
        type: 'app_mention',
        connectionId: conn.id,
        orgId: conn.orgId,
        slackChannelId,
        threadTs,
        text,
      };

      void this.botQueue.add('app_mention', jobData);
      this.logger.log(`Queued app_mention job for org ${conn.orgId} in channel ${slackChannelId}`);
    }
  }

  private handleDirectMessage(
    event: NonNullable<SlackEventBody['event']>,
    connections: ReadonlyArray<{
      id: DbId<'Connection'>;
      orgId: DbId<'Org'>;
      providerData: SlackProviderData;
    }>
  ): void {
    const slackChannelId = event.channel;
    const ts = event.ts;
    const text = (event.text ?? '').trim();

    if (!slackChannelId || !ts || !text) return;

    const threadTs = event.thread_ts ?? ts;

    for (const conn of connections) {
      const jobData: SlackBotJobData = {
        type: 'dm',
        connectionId: conn.id,
        orgId: conn.orgId,
        slackChannelId,
        threadTs,
        text,
      };

      void this.botQueue.add('dm', jobData);
      this.logger.log(`Queued dm job for org ${conn.orgId} in channel ${slackChannelId}`);
    }
  }

  private handleMemberJoined(
    event: NonNullable<SlackEventBody['event']>,
    connections: ReadonlyArray<{
      id: DbId<'Connection'>;
      orgId: DbId<'Org'>;
      providerData: SlackProviderData;
    }>
  ): void {
    const slackChannelId = event.channel;
    const joinedUserId = event.user;

    if (!slackChannelId || !joinedUserId) return;

    // Only trigger when the bot itself joins the channel
    for (const conn of connections) {
      if (conn.providerData.slackBotUserId && joinedUserId === conn.providerData.slackBotUserId) {
        const jobData: SlackBotJobData = {
          type: 'channel_joined',
          connectionId: conn.id,
          orgId: conn.orgId,
          slackChannelId,
        };

        void this.botQueue.add('channel_joined', jobData);
        this.logger.log(
          `Queued channel_joined job for org ${conn.orgId} in channel ${slackChannelId}`
        );
      }
    }
  }
}
