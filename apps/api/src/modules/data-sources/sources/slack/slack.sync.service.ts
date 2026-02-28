import { Injectable } from '@nestjs/common';

import type { DbId } from '@grabdy/common';

import type { IntegrationSync, SyncResult } from '../../../integrations/connector.interface';

import type { SlackProviderData } from './types';

@Injectable()
export class SlackSyncService implements IntegrationSync<'SLACK'> {
  async sync(
    _accessToken: string,
    providerData: SlackProviderData,
    _context: { connectionId: DbId<'Connection'>; orgId: DbId<'Org'> }
  ): Promise<SyncResult> {
    // Slack sync is handled by the integration-sync BullMQ processor
    return {
      type: 'items',
      items: [],
      deletedExternalIds: [],
      updatedProviderData: providerData,
      hasMore: false,
    };
  }
}
