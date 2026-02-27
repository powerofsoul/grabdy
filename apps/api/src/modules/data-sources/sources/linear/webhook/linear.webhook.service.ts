import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { LinearClient } from '@linear/sdk';

import type {
  IntegrationWebhook,
  SyncedItem,
  WebhookEvent,
  WebhookHandlerResult,
} from '../../../../integrations/connector.interface';
import { LinearIssueFetcher } from '../fetcher/issue.fetcher';
import { LinearOAuthService } from '../linear.oauth.service';
import type { LinearProviderData } from '../types';

import { extractIssueEvent } from './issue.webhook';

@Injectable()
export class LinearWebhookService implements IntegrationWebhook<'LINEAR'> {
  private readonly logger = new Logger(LinearWebhookService.name);

  constructor(
    private readonly oauth: LinearOAuthService,
    private readonly issueFetcher: LinearIssueFetcher
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
      providerData: LinearProviderData;
    }>,
    _rawBody?: string
  ): WebhookHandlerResult {
    const event = extractIssueEvent(body);
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
    _providerData: LinearProviderData,
    event: WebhookEvent
  ): Promise<{ item: SyncedItem | null; deletedExternalId: string | null }> {
    if (event.action === 'deleted') {
      return { item: null, deletedExternalId: event.externalId };
    }

    const client = new LinearClient({ accessToken });
    const item = await this.issueFetcher.fetchItem(client, event.externalId);
    if (!item) {
      this.logger.warn(`Could not fetch Linear issue ${event.externalId} for webhook sync`);
      return { item: null, deletedExternalId: null };
    }

    return { item, deletedExternalId: null };
  }
}
