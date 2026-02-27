import type { DbId } from '@grabdy/common';
import { executeChild, proxyActivities } from '@temporalio/workflow';

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

export async function notionSyncWorkflow(params: {
  orgId: DbId<'Org'>;
  connectionId: DbId<'Connection'>;
  trigger: string;
}): Promise<void> {
  const conn = await integration.loadConnectionWithTokens({
    connectionId: params.connectionId,
  });

  const result = await integration.runConnectorSync({
    accessToken: conn.accessToken,
    provider: conn.provider,
    providerData: conn.providerData,
    connectionId: params.connectionId,
    orgId: params.orgId,
  });

  if (result.type !== 'events') {
    throw new Error(`Notion sync expected events result, got ${result.type}`);
  }

  // Fan out discovered pages as child workflows in parallel
  const childPromises = result.events.map((event) =>
    executeChild(notionWebhookItemWorkflow, {
      workflowId: `notion-sync-item-${params.connectionId}-${event.externalId}`,
      args: [{ orgId: params.orgId, connectionId: params.connectionId, event }],
    })
  );
  await Promise.all(childPromises);

  // Handle deletions from sync
  for (const deletedId of result.deletedExternalIds) {
    await integration.deleteDataSourceByExternalId({
      connectionId: params.connectionId,
      orgId: params.orgId,
      externalId: deletedId,
    });
  }

  await integration.updateProviderData({
    connectionId: params.connectionId,
    providerData: result.updatedProviderData,
  });

  await integration.updateLastSynced({ connectionId: params.connectionId });
}

export async function notionWebhookItemWorkflow(params: {
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
