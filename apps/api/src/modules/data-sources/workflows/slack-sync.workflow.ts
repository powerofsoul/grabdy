import type { DbId } from '@grabdy/common';
import { executeChild, proxyActivities } from '@temporalio/workflow';

import type { IntegrationIngestionService } from '../services/integration-ingestion.service';
import type { FileIngestionService } from '../sources/file/file-ingestion.service';
import type { SlackIngestionService } from '../sources/slack/slack-ingestion.service';

const integration = proxyActivities<IntegrationIngestionService>({
  startToCloseTimeout: '5m',
  retry: {
    maximumAttempts: 3,
    initialInterval: '5s',
    backoffCoefficient: 2,
    maximumInterval: '2m',
  },
});

const slack = proxyActivities<SlackIngestionService>({
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

export async function slackSyncWorkflow(params: {
  orgId: DbId<'Org'>;
  connectionId: DbId<'Connection'>;
  trigger: string;
}): Promise<void> {
  // 1. Load connection and tokens
  const conn = await integration.loadConnectionWithTokens({
    connectionId: params.connectionId,
  });

  const providerData = conn.providerData;
  if (providerData.provider !== 'SLACK') {
    throw new Error('Expected SLACK provider data');
  }

  // 2. Join selected channels
  const selectedIds = providerData.selectedChannels ?? [];
  if (selectedIds.length > 0) {
    await slack.joinSlackChannels({
      accessToken: conn.accessToken,
      channels: selectedIds,
    });
  }

  // 3. Discover all member channels
  const channels = await slack.fetchSlackMemberChannels({
    accessToken: conn.accessToken,
  });

  // 4. Process each channel as a child workflow
  const childPromises = channels.map((channel) =>
    executeChild(slackChannelSyncWorkflow, {
      workflowId: `slack-channel-${params.connectionId}-${channel.id}-${Date.now()}`,
      args: [
        {
          orgId: params.orgId,
          connectionId: params.connectionId,
          channel,
        },
      ],
    })
  );

  await Promise.all(childPromises);

  // 5. Update last synced
  await integration.updateLastSynced({ connectionId: params.connectionId });
}

export async function slackChannelSyncWorkflow(params: {
  orgId: DbId<'Org'>;
  connectionId: DbId<'Connection'>;
  channel: { id: string; name: string };
}): Promise<void> {
  // 1. Load connection tokens (avoids persisting access token in workflow history)
  const conn = await integration.loadConnectionWithTokens({
    connectionId: params.connectionId,
  });

  const providerData = conn.providerData;
  if (providerData.provider !== 'SLACK') {
    throw new Error('Expected SLACK provider data');
  }

  // 2. Fetch channel messages
  const result = await slack.fetchSlackChannelMessages({
    accessToken: conn.accessToken,
    channel: params.channel,
    providerData,
  });

  // 3. Update channel timestamp
  if (result.newTimestamp) {
    const updatedTimestamps = { ...providerData.channelTimestamps };
    updatedTimestamps[params.channel.id] = result.newTimestamp;
    await integration.updateProviderData({
      connectionId: params.connectionId,
      providerData: { ...providerData, channelTimestamps: updatedTimestamps },
    });
  }

  if (!result.item) return;

  // 3. Upsert data source
  const dataSourceId = await integration.upsertDataSource({
    connectionId: params.connectionId,
    orgId: params.orgId,
    item: result.item,
    provider: 'SLACK',
  });

  // 4. Extract and embed
  const { chunks } = await ds.extractContent({
    dataSourceId,
    orgId: params.orgId,
    storagePath: '',
    mimeType: 'text/plain',
    content: result.item.content,
    messages: result.item.messages,
    sourceUrl: result.item.sourceUrl,
  });

  let chunkIndexOffset = 0;
  if (result.item.appendOnly) {
    chunkIndexOffset = await ds.getChunkOffset({ dataSourceId, orgId: params.orgId });
  } else {
    await ds.deleteChunks({ dataSourceId, orgId: params.orgId });
  }

  await ds.embedAndStore({
    chunks,
    chunkIndexOffset,
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

export async function slackBotWorkflow(params: {
  orgId: DbId<'Org'>;
  connectionId: DbId<'Connection'>;
  channel: string;
  threadTs: string;
  text: string;
}): Promise<void> {
  const conn = await integration.loadConnectionWithTokens({
    connectionId: params.connectionId,
  });

  const providerData = conn.providerData;
  if (providerData.provider !== 'SLACK') {
    throw new Error('Expected SLACK provider data');
  }

  try {
    await slack.runSlackAgent({
      org: params.orgId,
      accessToken: conn.accessToken,
      channel: params.channel,
      threadTs: params.threadTs,
      text: params.text,
      slackBotUserId: providerData.slackBotUserId,
    });
  } catch {
    await slack.postSlackErrorReply({
      accessToken: conn.accessToken,
      channel: params.channel,
      threadTs: params.threadTs,
    });
  }
}
