import type { DbId } from '@grabdy/common';
import { proxyActivities } from '@temporalio/workflow';

import type { SyncedItem } from '../../integrations/connector.interface';
import type { IntegrationIngestionService } from '../services/integration-ingestion.service';
import type { FileIngestionService } from '../sources/file/file-ingestion.service';

const integration = proxyActivities<IntegrationIngestionService>({
  startToCloseTimeout: '10m',
  retry: {
    maximumAttempts: 3,
    initialInterval: '5s',
    backoffCoefficient: 2,
    maximumInterval: '2m',
  },
});

const ds = proxyActivities<FileIngestionService>({
  startToCloseTimeout: '30m',
  retry: {
    maximumAttempts: 3,
    initialInterval: '5s',
    backoffCoefficient: 2,
    maximumInterval: '2m',
  },
});

export async function githubSyncWorkflow(params: {
  orgId: DbId<'Org'>;
  connectionId: DbId<'Connection'>;
  trigger: string;
}): Promise<void> {
  const conn = await integration.loadConnectionWithTokens({
    connectionId: params.connectionId,
  });

  let currentProviderData = conn.providerData;
  let hasMore = true;
  const MAX_SYNC_PAGES = 100;
  let page = 0;

  while (hasMore) {
    if (++page > MAX_SYNC_PAGES) {
      throw new Error(
        `GitHub sync exceeded ${MAX_SYNC_PAGES} pages, aborting to prevent infinite loop`
      );
    }
    const result = await integration.runConnectorSync({
      accessToken: conn.accessToken,
      provider: conn.provider,
      providerData: currentProviderData,
      connectionId: params.connectionId,
      orgId: params.orgId,
    });

    if (result.type !== 'items') {
      throw new Error(`GitHub sync expected items result, got ${result.type}`);
    }

    for (const item of result.items) {
      const dataSourceId = await integration.upsertDataSource({
        connectionId: params.connectionId,
        orgId: params.orgId,
        item,
        provider: conn.provider,
      });

      const { chunks } = await ds.extractContent({
        dataSourceId,
        orgId: params.orgId,
        storagePath: '',
        mimeType: 'text/plain',
        content: item.content,
        messages: item.messages,
        sourceUrl: item.sourceUrl,
      });

      if (!item.appendOnly) {
        await ds.deleteChunks({ dataSourceId, orgId: params.orgId });
      }

      const chunkOffset = item.appendOnly
        ? await ds.getChunkOffset({ dataSourceId, orgId: params.orgId })
        : 0;

      await ds.embedAndStore({
        chunks,
        chunkIndexOffset: chunkOffset,
        dataSourceId,
        collectionId: null,
        orgId: params.orgId,
        progressBase: 15,
      });

      await ds.updateDataSourceStatus({
        dataSourceId,
        orgId: params.orgId,
        status: 'READY',
        progress: 100,
      });
    }

    for (const deletedId of result.deletedExternalIds) {
      await integration.deleteDataSourceByExternalId({
        connectionId: params.connectionId,
        orgId: params.orgId,
        externalId: deletedId,
      });
    }

    currentProviderData = result.updatedProviderData;
    hasMore = result.hasMore;

    await integration.updateProviderData({
      connectionId: params.connectionId,
      providerData: currentProviderData,
    });
  }

  await integration.updateLastSynced({ connectionId: params.connectionId });
}

export async function githubWebhookItemWorkflow(params: {
  orgId: DbId<'Org'>;
  connectionId: DbId<'Connection'>;
  event: {
    action: 'created' | 'updated' | 'deleted';
    externalId: string;
    eventType?: string;
    data?: SyncedItem;
  };
}): Promise<void> {
  const conn = await integration.loadConnectionWithTokens({
    connectionId: params.connectionId,
  });

  const result = await integration.runWebhookFetchItem({
    accessToken: conn.accessToken,
    provider: conn.provider,
    providerData: conn.providerData,
    event: params.event,
  });

  if (result.item) {
    const dataSourceId = await integration.upsertDataSource({
      connectionId: params.connectionId,
      orgId: params.orgId,
      item: result.item,
      provider: conn.provider,
    });

    const { chunks } = await ds.extractContent({
      dataSourceId,
      orgId: params.orgId,
      storagePath: '',
      mimeType: 'text/plain',
      content: result.item.content,
      messages: result.item.messages,
      sourceUrl: result.item.sourceUrl,
    });

    await ds.deleteChunks({ dataSourceId, orgId: params.orgId });
    await ds.embedAndStore({
      chunks,
      chunkIndexOffset: 0,
      dataSourceId,
      collectionId: null,
      orgId: params.orgId,
      progressBase: 15,
    });

    await ds.updateDataSourceStatus({
      dataSourceId,
      orgId: params.orgId,
      status: 'READY',
      progress: 100,
    });
  }

  if (result.deletedExternalId) {
    await integration.deleteDataSourceByExternalId({
      connectionId: params.connectionId,
      orgId: params.orgId,
      externalId: result.deletedExternalId,
    });
  }

  await integration.updateLastSynced({ connectionId: params.connectionId });
}
