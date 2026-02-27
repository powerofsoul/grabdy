import type { DbId } from '@grabdy/common';
import { proxyActivities } from '@temporalio/workflow';

import type { IntegrationIngestionService } from '../services/integration-ingestion.service';

const integration = proxyActivities<IntegrationIngestionService>({
  startToCloseTimeout: '10m',
  retry: {
    maximumAttempts: 3,
    initialInterval: '5s',
    backoffCoefficient: 2,
    maximumInterval: '2m',
  },
});

export async function integrationCleanupWorkflow(params: {
  orgId: DbId<'Org'>;
  connectionId: DbId<'Connection'>;
}): Promise<void> {
  // 1. List all data sources for this connection
  const dataSources = await integration.listDataSourcesByConnection({
    connectionId: params.connectionId,
    orgId: params.orgId,
  });

  // 2. Enqueue cleanup for each (still uses BullMQ data-source-cleanup queue)
  if (dataSources.length > 0) {
    await integration.enqueueDataSourceCleanup({
      orgId: params.orgId,
      dataSources,
    });
  }

  // 3. Delete the connection record
  await integration.deleteConnection({
    connectionId: params.connectionId,
    orgId: params.orgId,
  });
}
