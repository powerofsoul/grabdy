import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { extractOrgNumericId, packId } from '@grabdy/common';
import type { Job, Queue } from 'bullmq';

import { DbService } from '../../../../db/db.module';
import { InjectTypedQueue } from '../../../../queue/queue.decorators';
import type { DataSourceJobData } from '../../../data-sources/data-source.types';
import { DataSourceDispatchService } from '../../../data-sources/data-source-dispatch.service';
import { parseProviderData } from '../../connector.interface';
import { IntegrationsService } from '../../integrations.service';

import { SlackChannelWebhook } from './webhooks/channel.webhook';

export interface SlackProcessChannelJobData {
  connectionId: DbId<'Connection'>;
  orgId: DbId<'Org'>;
  slackChannel: string;
  channelName: string;
  teamDomain?: string;
}

@Processor('slack-process-channel', { concurrency: 1 })
export class SlackProcessChannelProcessor extends WorkerHost {
  private readonly logger = new Logger(SlackProcessChannelProcessor.name);

  constructor(
    private readonly db: DbService,
    private readonly integrationsService: IntegrationsService,
    private readonly channelWebhook: SlackChannelWebhook,
    private readonly dataSourceDispatch: DataSourceDispatchService,
    @InjectTypedQueue('notification') private notificationQueue: Queue
  ) {
    super();
  }

  async process(job: Job<SlackProcessChannelJobData>): Promise<void> {
    const { connectionId, orgId, slackChannel, channelName, teamDomain } = job.data;

    this.logger.log(
      `Processing channel #${channelName} (${slackChannel}) for connection ${connectionId}${teamDomain ? ` [${teamDomain}]` : ''}`
    );

    const conn = await this.integrationsService.getConnectionById(connectionId);
    if (!conn) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    const providerData = parseProviderData(conn.provider_data);
    if (providerData.provider !== 'SLACK') {
      throw new Error(`Connection ${connectionId} is not a Slack connection`);
    }

    const channel = { id: slackChannel, name: channelName };
    const result = await this.channelWebhook.fetchSingleChannel(
      conn.access_token,
      channel,
      providerData
    );

    // Persist the updated timestamp for this channel
    if (result.newTimestamp) {
      const updatedTimestamps = { ...providerData.channelTimestamps };
      updatedTimestamps[slackChannel] = result.newTimestamp;
      await this.integrationsService.updateConnection(connectionId, {
        providerData: { ...providerData, channelTimestamps: updatedTimestamps },
      });
    }

    if (!result.item) {
      this.logger.log(`No new messages in #${channelName} (${slackChannel})`);
      return;
    }

    const item = result.item;

    // Create or update data source
    const existing = await this.db.kysely
      .selectFrom('data.data_sources')
      .select(['id'])
      .where('connection_id', '=', connectionId)
      .where('external_id', '=', item.externalId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    let dataSourceId: DbId<'DataSource'>;

    if (existing) {
      dataSourceId = existing.id;
      await this.db.kysely
        .updateTable('data.data_sources')
        .set({
          title: item.title,
          source_url: item.sourceUrl,
          status: item.appendOnly ? 'READY' : 'UPLOADED',
          updated_at: new Date(),
        })
        .where('id', '=', existing.id)
        .where('org_id', '=', orgId)
        .execute();

      if (!item.appendOnly) {
        await this.db.kysely
          .deleteFrom('data.chunks')
          .where('data_source_id', '=', existing.id)
          .where('org_id', '=', orgId)
          .execute();
      }
    } else {
      dataSourceId = packId('DataSource', extractOrgNumericId(orgId));

      await this.db.kysely
        .insertInto('data.data_sources')
        .values({
          id: dataSourceId,
          title: item.title,
          mime_type: 'text/plain',
          file_size: Buffer.byteLength(item.content, 'utf-8'),
          storage_path: '',
          type: 'SLACK',
          status: 'UPLOADED',
          connection_id: connectionId,
          external_id: item.externalId,
          source_url: item.sourceUrl,
          org_id: orgId,
          uploaded_by_id: null,
          updated_at: new Date(),
        })
        .execute();
    }

    const jobData: DataSourceJobData = {
      dataSourceId,
      orgId,
      storagePath: '',
      mimeType: 'text/plain',
      collectionId: null,
      content: item.content,
      messages: item.messages,
      sourceUrl: item.sourceUrl,
      appendOnly: item.appendOnly,
    };
    await this.dataSourceDispatch.dispatch(jobData);

    this.logger.log(
      `Synced #${channelName} (${slackChannel}): ${item.metadata.messageCount} messages${teamDomain ? ` [${teamDomain}]` : ''}`
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<SlackProcessChannelJobData>, err: Error) {
    const { channelName, slackChannel, teamDomain } = job.data;
    this.logger.error(
      `Failed to process #${channelName} (${slackChannel})${teamDomain ? ` [${teamDomain}]` : ''}: ${err.message}`
    );
    this.notificationQueue
      .add('slack', {
        orgId: null,
        type: 'slack-channel-sync-failure',
        text: `Slack channel sync failed: #${channelName} (${slackChannel}) - ${err.message}`,
      })
      .catch((e) => this.logger.error('Failed to enqueue failure notification', e));
  }
}
