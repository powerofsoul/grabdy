import { Injectable, Logger } from '@nestjs/common';

import type { Job } from 'bullmq';

import { DbService } from '../../../db/db.module';
import type { ChunkWithMeta, DataSourceJobData } from '../data-source.types';

import { EmbeddingService } from './embedding.service';

export interface ProcessingResult {
  chunks: ChunkWithMeta[];
  /** Display page count. Defaults to chunk count if not provided. */
  pageCount?: number;
}

@Injectable()
export class DataSourcePipelineService {
  private readonly logger = new Logger(DataSourcePipelineService.name);

  constructor(
    private db: DbService,
    private embeddingService: EmbeddingService
  ) {}

  /**
   * Run the standard data source processing pipeline:
   * 1. Set status PROCESSING (if not append-only)
   * 2. Call extractAndChunk() for type-specific logic
   * 3. Compute chunk offset (delete old or get max index)
   * 4. Embed and store chunks
   * 5. Set status READY with page count
   * On error: set status FAILED and rethrow.
   */
  async run(job: Job, extractAndChunk: () => Promise<ProcessingResult>): Promise<void> {
    const data: DataSourceJobData = job.data;
    const { dataSourceId, orgId, collectionId } = data;
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

      const result = await extractAndChunk();

      this.logger.log(
        `Split into ${result.chunks.length} chunks${isAppendOnly ? ' (append)' : ''}`
      );

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

      await this.embeddingService.setProgress(job, dataSourceId, orgId, 15);

      await this.embeddingService.embedAndStore(
        job,
        result.chunks,
        chunkIndexOffset,
        dataSourceId,
        collectionId,
        orgId,
        15
      );

      const totalChunks = isAppendOnly
        ? chunkIndexOffset + result.chunks.length
        : result.chunks.length;

      await this.db.kysely
        .updateTable('data.data_sources')
        .set({
          status: 'READY',
          page_count: result.pageCount ?? totalChunks,
          processing_progress: 100,
          updated_at: new Date(),
        })
        .where('id', '=', dataSourceId)
        .where('org_id', '=', orgId)
        .execute();

      this.logger.log(`Data source ${dataSourceId} processed: ${totalChunks} chunks`);
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
}
