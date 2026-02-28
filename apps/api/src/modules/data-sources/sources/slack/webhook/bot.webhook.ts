import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import type { Queue } from 'bullmq';

import { InjectTypedQueue } from '../../../../../queue/queue.decorators';
import type { SlackProviderData } from '../types';

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
export class SlackBotWebhookHandler {
  private readonly logger = new Logger(SlackBotWebhookHandler.name);

  constructor(
    @InjectTypedQueue('slack-bot') private readonly slackBotQueue: Queue,
    @InjectTypedQueue('integration-sync') private readonly syncQueue: Queue
  ) {}

  /**
   * Handle an incoming Slack Events API request.
   * Returns `{ handled: true }` if the event was processed (or is url_verification),
   * or `{ handled: false }` if it should fall through to normal sync handling.
   */
  handleWebhook(
    body: unknown,
    connections: ReadonlyArray<{
      id: DbId<'Connection'>;
      orgId: DbId<'Org'>;
      providerData: SlackProviderData;
    }>
  ): SlackWebhookResult {
    if (!isSlackEventBody(body)) return { handled: false };

    // Signature already verified by SlackWebhookService.verify in the controller
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

    // Not a bot event. Let the controller handle it as a normal sync webhook
    return { handled: false };
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

    // Strip @mention prefix from text
    text = text.replace(/<@[A-Z0-9]+>/g, '').trim();
    if (!text) return;

    const threadTs = event.thread_ts ?? ts;

    for (const conn of connections) {
      this.slackBotQueue
        .add('slack-bot', {
          orgId: conn.orgId,
          connectionId: conn.id,
          channel: slackChannelId,
          threadTs,
          text,
        })
        .catch((e) => this.logger.error('Failed to enqueue slackBotJob', e));
      this.logger.log(`Enqueued slackBotJob for org ${conn.orgId} in channel ${slackChannelId}`);
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
      this.slackBotQueue
        .add('slack-bot', {
          orgId: conn.orgId,
          connectionId: conn.id,
          channel: slackChannelId,
          threadTs,
          text,
        })
        .catch((e) => this.logger.error('Failed to enqueue slackBotJob', e));
      this.logger.log(`Enqueued slackBotJob for org ${conn.orgId} in channel ${slackChannelId}`);
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
        this.syncQueue
          .add('slack', {
            connectionId: conn.id,
            orgId: conn.orgId,
            trigger: 'WEBHOOK',
          })
          .catch((e) => this.logger.error('Failed to enqueue slackSyncJob', e));
        this.logger.log(
          `Enqueued slackSyncJob for org ${conn.orgId} after channel join ${slackChannelId}`
        );
      }
    }
  }
}
