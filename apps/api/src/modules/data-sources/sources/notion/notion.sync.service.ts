import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { Client } from '@notionhq/client';

import type { IntegrationSync, SyncResult } from '../../../integrations/connector.interface';
import { getInitialSyncSince } from '../../../integrations/integrations.constants';

import { NotionPageFetcher } from './fetcher/page.fetcher';
import type { NotionProviderData } from './types';

@Injectable()
export class NotionSyncService implements IntegrationSync<'NOTION'> {
  private readonly logger = new Logger(NotionSyncService.name);

  constructor(private readonly pageFetcher: NotionPageFetcher) {}

  async sync(
    accessToken: string,
    providerData: NotionProviderData,
    _context: { connectionId: DbId<'Connection'>; orgId: DbId<'Org'> }
  ): Promise<SyncResult> {
    const client = new Client({ auth: accessToken });
    const since = providerData.lastSyncedAt ?? getInitialSyncSince();

    const result = await this.pageFetcher.fetchUpdatedItems(client, since);
    const maxEditedTime = result.maxEditedTime ?? providerData.lastSyncedAt;

    this.logger.log(`Notion sync discovered ${result.webhookEvents.length} pages to process`);

    return {
      type: 'events',
      events: result.webhookEvents,
      deletedExternalIds: [],
      updatedProviderData: { ...providerData, lastSyncedAt: maxEditedTime },
    };
  }
}
