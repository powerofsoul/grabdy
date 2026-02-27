import type { DbId } from '@grabdy/common';
import { proxyActivities } from '@temporalio/workflow';

import type { SyncedMessageData } from '../data-source.types';
import type { FileIngestionService } from '../sources/file/file-ingestion.service';

const ds = proxyActivities<FileIngestionService>({
  startToCloseTimeout: '30m',
  retry: {
    maximumAttempts: 3,
    initialInterval: '5s',
    backoffCoefficient: 2,
    maximumInterval: '2m',
  },
});

export async function fileIngestionWorkflow(params: {
  orgId: DbId<'Org'>;
  dataSourceId: DbId<'DataSource'>;
  storagePath: string;
  mimeType: string;
  collectionId: DbId<'Collection'> | null;
  content?: string;
  messages?: SyncedMessageData[];
  sourceUrl?: string;
  appendOnly?: boolean;
}): Promise<void> {
  const isAppendOnly = Boolean(params.appendOnly);

  try {
    // 1. Set status PROCESSING
    if (!isAppendOnly) {
      await ds.updateDataSourceStatus({
        dataSourceId: params.dataSourceId,
        orgId: params.orgId,
        status: 'PROCESSING',
        progress: 0,
      });
    }

    // 2. PDF gets its own specialized activity that handles temp files + range extraction
    if (params.mimeType === 'application/pdf') {
      const { pageCount } = await ds.extractPdf({
        dataSourceId: params.dataSourceId,
        orgId: params.orgId,
        storagePath: params.storagePath,
        collectionId: params.collectionId,
        appendOnly: isAppendOnly,
      });

      await ds.updateDataSourceStatus({
        dataSourceId: params.dataSourceId,
        orgId: params.orgId,
        status: 'READY',
        pageCount,
        progress: 100,
      });
      return;
    }

    // 3. Non-PDF extraction
    const { chunks, pageCount } = await ds.extractContent({
      dataSourceId: params.dataSourceId,
      orgId: params.orgId,
      storagePath: params.storagePath,
      mimeType: params.mimeType,
      content: params.content,
      messages: params.messages,
      sourceUrl: params.sourceUrl,
    });

    // 4. Handle chunk offset
    let chunkIndexOffset = 0;
    if (!isAppendOnly) {
      await ds.deleteChunks({
        dataSourceId: params.dataSourceId,
        orgId: params.orgId,
      });
    } else {
      chunkIndexOffset = await ds.getChunkOffset({
        dataSourceId: params.dataSourceId,
        orgId: params.orgId,
      });
    }

    // 5. Embed and store
    await ds.embedAndStore({
      chunks,
      chunkIndexOffset,
      dataSourceId: params.dataSourceId,
      collectionId: params.collectionId,
      orgId: params.orgId,
      progressBase: 15,
    });

    // 6. Set status READY
    const totalChunks = isAppendOnly ? chunkIndexOffset + chunks.length : chunks.length;
    await ds.updateDataSourceStatus({
      dataSourceId: params.dataSourceId,
      orgId: params.orgId,
      status: 'READY',
      pageCount: pageCount ?? totalChunks,
      progress: 100,
    });
  } catch (error) {
    await ds.updateDataSourceStatus({
      dataSourceId: params.dataSourceId,
      orgId: params.orgId,
      status: 'FAILED',
    });
    throw error;
  }
}
