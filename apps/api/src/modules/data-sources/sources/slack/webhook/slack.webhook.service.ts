import { Injectable } from '@nestjs/common';

import type { DbId } from '@grabdy/common';

import type {
  IntegrationWebhook,
  SyncedItem,
  WebhookEvent,
  WebhookHandlerResult,
} from '../../../../integrations/connector.interface';
import { SlackOAuthService } from '../slack.oauth.service';
import type { SlackProviderData } from '../types';

import { SlackBotWebhookHandler } from './bot.webhook';

@Injectable()
export class SlackWebhookService implements IntegrationWebhook<'SLACK'> {
  constructor(
    private readonly oauth: SlackOAuthService,
    private readonly botHandler: SlackBotWebhookHandler
  ) {}

  verify(headers: Record<string, string>, _body: unknown, rawBody?: string): boolean {
    return this.oauth.verifyWebhookSignature(headers, rawBody ?? '');
  }

  handleEvent(
    _headers: Record<string, string>,
    body: unknown,
    connections: ReadonlyArray<{
      id: DbId<'Connection'>;
      orgId: DbId<'Org'>;
      providerData: SlackProviderData;
    }>,
    _rawBody?: string
  ): WebhookHandlerResult {
    // Delegate bot events (app_mention, member_joined, DM) to bot handler
    const botResult = this.botHandler.handleWebhook(body, connections);
    if (botResult.handled) {
      return { response: { ok: true } };
    }

    // Non-bot events are acknowledged but no incremental sync is performed
    return { response: { ok: true } };
  }

  async fetchItem(
    _accessToken: string,
    _providerData: SlackProviderData,
    _event: WebhookEvent
  ): Promise<{ item: SyncedItem | null; deletedExternalId: string | null }> {
    // Slack doesn't do incremental webhook item fetching
    return { item: null, deletedExternalId: null };
  }
}
