import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import type { Job, Queue } from 'bullmq';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

import {
  DS_CONCURRENCY_GLOBAL,
  DS_LOCK_DURATION_MS,
  PDF_PAGE_OVERLAP,
  PDF_PAGE_RANGE_SIZE,
} from '../../../config/constants';
import { DbService } from '../../../db/db.module';
import { InjectTypedQueue } from '../../../queue/queue.decorators';
import { S3FileStorage } from '../../storage/s3-file-storage';
import { chunkPages } from '../chunking/chunk-content';
import type { ChunkWithMeta, DataSourceJobData } from '../data-source.types';
import { buildSource } from '../data-source.types';
import { ImageExtractor } from '../image/image.extractor';
import { EmbeddingService } from '../pipeline/embedding.service';

import { PdfExtractor } from './pdf.extractor';

const execFileAsync = promisify(execFile);

@Processor('ds-pdf', { concurrency: DS_CONCURRENCY_GLOBAL, lockDuration: DS_LOCK_DURATION_MS })
export class DsPdfProcessor extends WorkerHost {
  private readonly logger = new Logger(DsPdfProcessor.name);

  constructor(
    private db: DbService,
    private storage: S3FileStorage,
    private pdfExtractor: PdfExtractor,
    private imageExtractor: ImageExtractor,
    private embeddingService: EmbeddingService,
    @InjectTypedQueue('notification') private notificationQueue: Queue
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const data: DataSourceJobData = job.data;
    const { dataSourceId, orgId, storagePath, collectionId } = data;
    const source = buildSource(data);
    const isAppendOnly = Boolean(data.appendOnly);

    try {
      if (!isAppendOnly) {
        await this.db.kysely
          .updateTable('data.data_sources')
          .set({ status: 'PROCESSING', processing_progress: 0, updated_at: new Date() })
          .where('id', '=', dataSourceId)
          .where('org_id', '=', orgId)
          .execute();
      }

      // Download the PDF to a temp file once for all operations
      const tempPdf = await this.storage.getTempPath(storagePath);

      try {
        const pageCount = await this.pdfExtractor.getPageCountFromFile(tempPdf.path);
        if (pageCount === 0) {
          throw new Error('No text content extracted from file');
        }

        // Linearize the PDF for efficient byte-range serving, then re-upload
        const linearizedPath = `${tempPdf.path}-linearized.pdf`;
        try {
          await execFileAsync('qpdf', ['--linearize', tempPdf.path, linearizedPath]);
          const linearizedBuf = await readFile(linearizedPath);
          await this.storage.put(storagePath, Buffer.from(linearizedBuf), 'application/pdf');
        } finally {
          await execFileAsync('rm', ['-f', linearizedPath]).catch(() => {});
        }

        let chunkIndexOffset = 0;
        if (!isAppendOnly) {
          await this.db.kysely
            .deleteFrom('data.chunks')
            .where('data_source_id', '=', dataSourceId)
            .where('org_id', '=', orgId)
            .execute();
        } else {
          const maxRow = await this.db.kysely
            .selectFrom('data.chunks')
            .select(this.db.kysely.fn.max('chunk_index').as('max_index'))
            .where('data_source_id', '=', dataSourceId)
            .where('org_id', '=', orgId)
            .executeTakeFirst();
          chunkIndexOffset = maxRow?.max_index != null ? maxRow.max_index + 1 : 0;
        }

        await this.embeddingService.setProgress(job, dataSourceId, orgId, 2);

        // Build page ranges
        const ranges: Array<{ start: number; end: number }> = [];
        for (let start = 1; start <= pageCount; start += PDF_PAGE_RANGE_SIZE) {
          const end = Math.min(start + PDF_PAGE_RANGE_SIZE - 1, pageCount);
          ranges.push({ start, end });
        }

        let totalChunksStored = 0;

        for (let rangeIdx = 0; rangeIdx < ranges.length; rangeIdx++) {
          const range = ranges[rangeIdx];
          const extractStart = Math.max(1, range.start - PDF_PAGE_OVERLAP);
          const extractEnd = Math.min(pageCount, range.end + PDF_PAGE_OVERLAP);

          const pages = await this.pdfExtractor.extractPageRangeFromFile(
            tempPdf.path,
            extractStart,
            extractEnd
          );

          const textChunks = pages.length > 0 ? chunkPages(pages, 'PDF', source) : [];

          // Keep only chunks anchored to this range's owned pages
          const ownedTextChunks = textChunks.filter((c) => {
            const meta = c.metadata;
            if (meta.type !== 'PDF') return true;
            const minPage = Math.min(...meta.pages);
            return minPage >= range.start && minPage <= range.end;
          });

          // Extract, upload, and analyze images
          const { images, cleanup: cleanupImages } =
            await this.pdfExtractor.extractImagesToDiskFromFile(
              tempPdf.path,
              range.start,
              range.end
            );

          let imageChunks: ChunkWithMeta[] = [];
          try {
            imageChunks = await this.imageExtractor.analyzeImages(
              images,
              orgId,
              collectionId,
              dataSourceId,
              source
            );
          } finally {
            await cleanupImages();
          }

          const rangeChunks = [...ownedTextChunks, ...imageChunks];

          if (rangeChunks.length > 0) {
            const rangeOffset = chunkIndexOffset + totalChunksStored;
            await this.embeddingService.embedAndStore(
              job,
              rangeChunks,
              rangeOffset,
              dataSourceId,
              collectionId,
              orgId,
              2 + Math.round(((rangeIdx + 0.5) / ranges.length) * 93)
            );
            totalChunksStored += rangeChunks.length;
          }

          const rangeProgress = 2 + Math.round(((rangeIdx + 1) / ranges.length) * 93);
          await this.embeddingService.setProgress(job, dataSourceId, orgId, rangeProgress);
        }

        if (totalChunksStored === 0) {
          throw new Error('No text content extracted from file');
        }

        await this.db.kysely
          .updateTable('data.data_sources')
          .set({
            status: 'READY',
            page_count: pageCount,
            processing_progress: 100,
            updated_at: new Date(),
          })
          .where('id', '=', dataSourceId)
          .where('org_id', '=', orgId)
          .execute();

        this.logger.log(
          `PDF processed in ${ranges.length} range(s): ${totalChunksStored} chunks total`
        );
      } finally {
        await tempPdf.cleanup();
      }
    } catch (error) {
      this.logger.error(
        `Data source ${dataSourceId} failed: ${error instanceof Error ? error.message : String(error)}`
      );
      await this.db.kysely
        .updateTable('data.data_sources')
        .set({ status: 'FAILED', updated_at: new Date() })
        .where('id', '=', dataSourceId)
        .where('org_id', '=', orgId)
        .execute();
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}(${job.id}) failed: ${err.message}`);
    this.notificationQueue
      .add('slack', {
        orgId: null,
        type: 'data-source-failure',
        text: `PDF processing failed: ${job.name}(${job.id}) - ${err.message}`,
      })
      .catch((e) => this.logger.error('Failed to enqueue failure notification', e));
  }
}
