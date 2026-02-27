import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { Client } from '@notionhq/client';

import type {
  IntegrationWebhook,
  SyncedItem,
  WebhookEvent,
  WebhookHandlerResult,
} from '../../../../integrations/connector.interface';
import { NotionPageFetcher } from '../fetcher/page.fetcher';
import { NotionOAuthService } from '../notion.oauth.service';
import type { NotionProviderData } from '../types';

import { extractPageEvent } from './page.webhook';

@Injectable()
export class NotionWebhookService implements IntegrationWebhook<'NOTION'> {
  private readonly logger = new Logger(NotionWebhookService.name);

  constructor(
    private readonly oauth: NotionOAuthService,
    private readonly pageFetcher: NotionPageFetcher
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
      providerData: NotionProviderData;
    }>,
    _rawBody?: string
  ): WebhookHandlerResult {
    const event = extractPageEvent(body);
    if (!event) {
      return { response: { ok: true } };
    }

    const syncConnections = connections.map((conn) => ({
      id: conn.id,
      orgId: conn.orgId,
      event,
    }));

    return { response: { ok: true }, syncConnections };
  }

  async fetchItem(
    accessToken: string,
    _providerData: NotionProviderData,
    event: WebhookEvent
  ): Promise<{ item: SyncedItem | null; deletedExternalId: string | null }> {
    if (event.action === 'deleted') {
      return { item: null, deletedExternalId: event.externalId };
    }

    const client = new Client({ auth: accessToken });
    const item = await this.pageFetcher.fetchItem(client, event.externalId);
    if (!item) {
      this.logger.warn(`Could not fetch Notion page ${event.externalId} for webhook sync`);
    }
    return { item: item ?? null, deletedExternalId: null };
  }
}
