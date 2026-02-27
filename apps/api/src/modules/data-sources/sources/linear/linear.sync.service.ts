import { Injectable } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { LinearClient } from '@linear/sdk';

import type { IntegrationSync, SyncResult } from '../../../integrations/connector.interface';
import { getInitialSyncSince } from '../../../integrations/integrations.constants';

import { LinearIssueFetcher } from './fetcher/issue.fetcher';
import type { LinearProviderData } from './types';

@Injectable()
export class LinearSyncService implements IntegrationSync<'LINEAR'> {
  constructor(private readonly issueFetcher: LinearIssueFetcher) {}

  async sync(
    accessToken: string,
    providerData: LinearProviderData,
    _context: { connectionId: DbId<'Connection'>; orgId: DbId<'Org'> }
  ): Promise<SyncResult> {
    const client = new LinearClient({ accessToken });
    const sinceCursor = providerData.lastIssueSyncedAt ?? getInitialSyncSince();

    const result = await this.issueFetcher.fetchUpdatedItems(client, sinceCursor);

    return {
      type: 'items',
      items: result.items,
      deletedExternalIds: [],
      updatedProviderData: {
        ...providerData,
        lastIssueSyncedAt: result.maxUpdatedAt ?? providerData.lastIssueSyncedAt,
      },
      hasMore: result.hasMore,
    };
  }
}
