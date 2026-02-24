import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import type { ChunkMeta } from '@grabdy/contracts';
import type { Job, Queue } from 'bullmq';

import { DS_CONCURRENCY_GLOBAL, DS_LOCK_DURATION_MS } from '../../../config/constants';
import { InjectTypedQueue } from '../../../queue/queue.decorators';
import { S3FileStorage } from '../../storage/s3-file-storage';
import { chunkPlainText } from '../chunking/chunk-content';
import type { DataSourceJobData } from '../data-source.types';
import { buildSource } from '../data-source.types';
import { EmbeddingService } from '../pipeline/embedding.service';
import { DataSourcePipelineService } from '../pipeline/pipeline.service';

import { TextExtractor } from './text.extractor';

@Processor('ds-text', { concurrency: DS_CONCURRENCY_GLOBAL, lockDuration: DS_LOCK_DURATION_MS })
export class DsTextProcessor extends WorkerHost {
  private readonly logger = new Logger(DsTextProcessor.name);

  constructor(
    private pipeline: DataSourcePipelineService,
    private embeddingService: EmbeddingService,
    private storage: S3FileStorage,
    private textExtractor: TextExtractor,
    @InjectTypedQueue('notification') private notificationQueue: Queue
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const data: DataSourceJobData = job.data;
    const source = buildSource(data);

    await this.pipeline.run(job, async () => {
      let fullText: string;
      if (data.content) {
        fullText = data.content;
      } else {
        const buffer = await this.storage.get(data.storagePath);
        const result = this.textExtractor.extract(buffer);
        fullText = result.text;
      }

      if (!fullText.trim()) {
        throw new Error('No text content extracted from file');
      }

      await this.embeddingService.setProgress(job, data.dataSourceId, data.orgId, 10);

      const meta: ChunkMeta =
        data.mimeType === 'application/json' ? { type: 'JSON' } : { type: 'TXT' };
      return { chunks: chunkPlainText(fullText, meta, source) };
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}(${job.id}) failed: ${err.message}`);
    this.notificationQueue
      .add('slack', {
        orgId: null,
        type: 'data-source-failure',
        text: `Text processing failed: ${job.name}(${job.id}) - ${err.message}`,
      })
      .catch((e) => this.logger.error('Failed to enqueue failure notification', e));
  }
}
