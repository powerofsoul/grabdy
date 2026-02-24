import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import type { Job, Queue } from 'bullmq';

import { DS_CONCURRENCY_GLOBAL, DS_LOCK_DURATION_MS } from '../../../config/constants';
import { InjectTypedQueue } from '../../../queue/queue.decorators';
import { chunkPlainText, groupMessages } from '../chunking/chunk-content';
import type { DataSourceJobData } from '../data-source.types';
import { buildSource } from '../data-source.types';
import { EmbeddingService } from '../pipeline/embedding.service';
import { DataSourcePipelineService } from '../pipeline/pipeline.service';

@Processor('ds-messages', { concurrency: DS_CONCURRENCY_GLOBAL, lockDuration: DS_LOCK_DURATION_MS })
export class DsMessagesProcessor extends WorkerHost {
  private readonly logger = new Logger(DsMessagesProcessor.name);

  constructor(
    private pipeline: DataSourcePipelineService,
    private embeddingService: EmbeddingService,
    @InjectTypedQueue('notification') private notificationQueue: Queue
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const data: DataSourceJobData = job.data;
    const source = buildSource(data);

    await this.pipeline.run(job, async () => {
      let chunks;

      if (data.messages) {
        const msgs = data.messages.filter((m) => m.content.trim().length > 0);
        const fullText = msgs.map((m) => m.content).join('\n');
        if (!fullText.trim()) {
          throw new Error('No text content extracted');
        }
        chunks = groupMessages(msgs);
      } else if (data.content) {
        if (!data.content.trim()) {
          throw new Error('No text content extracted');
        }
        chunks = chunkPlainText(data.content, { type: 'TXT' }, source);
      } else {
        throw new Error('Messages processor requires either messages or content');
      }

      await this.embeddingService.setProgress(job, data.dataSourceId, data.orgId, 10);

      return { chunks };
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}(${job.id}) failed: ${err.message}`);
    this.notificationQueue
      .add('slack', {
        orgId: null,
        type: 'data-source-failure',
        text: `Messages processing failed: ${job.name}(${job.id}) - ${err.message}`,
      })
      .catch((e) => this.logger.error('Failed to enqueue failure notification', e));
  }
}
