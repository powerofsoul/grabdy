import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import type { Job, Queue } from 'bullmq';

import { DS_CONCURRENCY_GLOBAL, DS_LOCK_DURATION_MS } from '../../../config/constants';
import { InjectTypedQueue } from '../../../queue/queue.decorators';
import { S3FileStorage } from '../../storage/s3-file-storage';
import { chunkPages } from '../chunking/chunk-content';
import type { DataSourceJobData } from '../data-source.types';
import { buildSource } from '../data-source.types';
import { EmbeddingService } from '../pipeline/embedding.service';
import { DataSourcePipelineService } from '../pipeline/pipeline.service';

import { DocxExtractor } from './docx.extractor';

@Processor('ds-docx', { concurrency: DS_CONCURRENCY_GLOBAL, lockDuration: DS_LOCK_DURATION_MS })
export class DsDocxProcessor extends WorkerHost {
  private readonly logger = new Logger(DsDocxProcessor.name);

  constructor(
    private pipeline: DataSourcePipelineService,
    private embeddingService: EmbeddingService,
    private storage: S3FileStorage,
    private docxExtractor: DocxExtractor,
    @InjectTypedQueue('notification') private notificationQueue: Queue
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const data: DataSourceJobData = job.data;
    const source = buildSource(data);

    await this.pipeline.run(job, async () => {
      const buffer = await this.storage.get(data.storagePath);
      const result = await this.docxExtractor.extract(buffer);
      if (result.type !== 'pages') {
        throw new Error('DOCX extractor returned unexpected result type');
      }
      if (!result.text.trim()) {
        throw new Error('No text content extracted from file');
      }

      await this.embeddingService.setProgress(job, data.dataSourceId, data.orgId, 10);

      return { chunks: chunkPages(result.pages, 'DOCX', source), pageCount: result.pages.length };
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}(${job.id}) failed: ${err.message}`);
    void this.notificationQueue.add('slack', {
      orgId: null,
      type: 'data-source-failure',
      text: `DOCX processing failed: ${job.name}(${job.id}) - ${err.message}`,
    });
  }
}
