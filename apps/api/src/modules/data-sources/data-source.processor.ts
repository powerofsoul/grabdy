import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';

import { openai } from '@ai-sdk/openai';
import type { DbId } from '@grabdy/common';
import { packId } from '@grabdy/common';
import { type ChunkMeta, UPLOADS_MIME_TO_TYPE, type UploadsMime } from '@grabdy/contracts';
import { Job } from 'bullmq';

import { EMBEDDING_BATCH_SIZE } from '../../config/constants';
import { env } from '../../config/env.config';
import { DbService } from '../../db/db.module';
import { AiService } from '../ai/ai.service';
import { DocxExtractor } from '../extractors/docx.extractor';
import type { ExtractionResult } from '../extractors/extractor.interface';
import { ImageExtractor } from '../extractors/image.extractor';
import { PdfExtractor } from '../extractors/pdf.extractor';
import { TextExtractor } from '../extractors/text.extractor';
import { XlsxExtractor } from '../extractors/xlsx.extractor';
import { DATA_SOURCE_QUEUE } from '../queue/queue.constants';
import type { FileStorage } from '../storage/file-storage.interface';
import { FILE_STORAGE } from '../storage/file-storage.interface';

import {
  chunkCsv,
  chunkPages,
  chunkPlainText,
  chunkSheets,
  groupMessages,
} from './chunking/chunk-content';
import type { ChunkWithMeta, DataSourceJobData } from './data-source.types';

/** Build a preview URL for an uploaded data source. */
function previewUrl(dataSourceId: DbId<'DataSource'>, orgId: DbId<'Org'>): string {
  return `${env.frontendUrl}/dashboard/sources?preview=${dataSourceId}&org=${orgId}`;
}

@Processor(DATA_SOURCE_QUEUE, { concurrency: 25, lockDuration: 30 * 60 * 1000 })
export class DataSourceProcessor extends WorkerHost {
  private readonly logger = new Logger(DataSourceProcessor.name);

  constructor(
    private db: DbService,
    @Inject(FILE_STORAGE) private storage: FileStorage,
    private pdfExtractor: PdfExtractor,
    private docxExtractor: DocxExtractor,
    private textExtractor: TextExtractor,
    private xlsxExtractor: XlsxExtractor,
    private imageExtractor: ImageExtractor,
    private aiService: AiService
  ) {
    super();
  }

  async process(job: Job<DataSourceJobData>): Promise<void> {
    const { dataSourceId, orgId, storagePath, mimeType, collectionId } = job.data;
    this.logger.log(`Processing data source ${dataSourceId}`);

    const defaultSourceUrl = job.data.sourceUrl ?? previewUrl(dataSourceId, orgId);

    const isAppendOnly = Boolean(job.data.appendOnly);

    try {
      // Update status to PROCESSING (append-only stays READY since old chunks are still valid)
      if (!isAppendOnly) {
        await this.db.kysely
          .updateTable('data.data_sources')
          .set({ status: 'PROCESSING', updated_at: new Date() })
          .where('id', '=', dataSourceId)
          .where('org_id', '=', orgId)
          .execute();
      }

      // Extract content: use pre-extracted for integration sources, otherwise read from storage
      let chunks: ChunkWithMeta[];
      let fullText: string;
      let pageCount: number | null = null;

      // Progress budget: extraction 0-50%, chunking 50-55%, embedding 55-100%
      const onExtractionProgress = async (fraction: number) => {
        await job.updateProgress(Math.round(fraction * 50));
      };

      if (job.data.messages) {
        // Group consecutive messages into conversation-window chunks
        const msgs = job.data.messages.filter((m) => m.content.trim().length > 0);
        fullText = msgs.map((m) => m.content).join('\n');
        chunks = groupMessages(msgs);
      } else if (job.data.content) {
        fullText = job.data.content;
        chunks = chunkPlainText(fullText, { type: 'TXT' }, defaultSourceUrl);
      } else if (mimeType.startsWith('image/')) {
        // Image files get special handling: AI vision extracts description
        const meta = await this.imageExtractor.extractWithMetadata(storagePath, orgId);
        fullText = meta.text;
        chunks = chunkPlainText(fullText, { type: 'IMAGE' }, defaultSourceUrl);
      } else {
        const result = await this.extractContent(
          storagePath,
          mimeType,
          orgId,
          onExtractionProgress
        );
        fullText = result.text;
        chunks = this.chunksFromResult(result, defaultSourceUrl, mimeType);
        pageCount = result.type === 'pages' ? result.pages.length : null;
      }

      await job.updateProgress(50);

      if (!fullText.trim()) {
        throw new Error('No text content extracted from file');
      }

      this.logger.log(`Split into ${chunks.length} chunks${isAppendOnly ? ' (append)' : ''}`);

      // For non-append jobs, delete existing chunks so retries are idempotent
      // and no orphaned chunks remain from partial previous runs.
      // For append-only, start chunk_index after the last existing chunk.
      let chunkIndexOffset = 0;
      if (!isAppendOnly) {
        await this.db.kysely
          .deleteFrom('data.chunks')
          .where('data_source_id', '=', dataSourceId)
          .where('org_id', '=', orgId)
          .execute();
      }

      if (isAppendOnly) {
        const maxRow = await this.db.kysely
          .selectFrom('data.chunks')
          .select(this.db.kysely.fn.max('chunk_index').as('max_index'))
          .where('data_source_id', '=', dataSourceId)
          .where('org_id', '=', orgId)
          .executeTakeFirst();
        chunkIndexOffset = maxRow?.max_index != null ? maxRow.max_index + 1 : 0;
      }

      await job.updateProgress(55);

      // Generate embeddings in batches
      const batchSize = EMBEDDING_BATCH_SIZE;

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);

        const { embeddings } = await this.aiService.embedMany(
          {
            model: openai.embedding('text-embedding-3-small'),
            values: batch.map((c) => c.content),
          },
          { orgId, source: 'SYSTEM' }
        );

        // Store chunks with embeddings
        const values = batch.map((chunk, idx) => ({
          id: packId('Chunk', orgId),
          content: chunk.content,
          chunk_index: chunkIndexOffset + i + idx,
          metadata: chunk.metadata,
          source_url: chunk.sourceUrl,
          embedding: `[${embeddings[idx].join(',')}]`,
          data_source_id: dataSourceId,
          collection_id: collectionId,
          org_id: orgId,
        }));

        await this.db.kysely.insertInto('data.chunks').values(values).execute();

        await job.updateProgress(55 + Math.min(((i + batchSize) / chunks.length) * 45, 45));
      }

      // Update data source status to READY
      const totalChunks = isAppendOnly ? chunkIndexOffset + chunks.length : chunks.length;
      await this.db.kysely
        .updateTable('data.data_sources')
        .set({
          status: 'READY',
          page_count: pageCount ?? totalChunks,
          updated_at: new Date(),
        })
        .where('id', '=', dataSourceId)
        .where('org_id', '=', orgId)
        .execute();

      this.logger.log(`Data source ${dataSourceId} processed successfully`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process data source ${dataSourceId}: ${message}`);

      await this.db.kysely
        .updateTable('data.data_sources')
        .set({ status: 'FAILED', updated_at: new Date() })
        .where('id', '=', dataSourceId)
        .where('org_id', '=', orgId)
        .execute();

      throw error;
    }
  }

  private chunksFromResult(
    result: ExtractionResult,
    sourceUrl: string,
    mimeType: UploadsMime
  ): ChunkWithMeta[] {
    const dsType = UPLOADS_MIME_TO_TYPE[mimeType];

    switch (result.type) {
      case 'pages':
        return chunkPages(result.pages, dsType === 'DOCX' ? 'DOCX' : 'PDF', sourceUrl);
      case 'sheets':
        return chunkSheets(result.sheets, sourceUrl);
      case 'rows':
        return chunkCsv(result.rows, result.columns, sourceUrl);
      case 'text': {
        const meta: ChunkMeta =
          dsType === 'JSON'
            ? { type: 'JSON' }
            : dsType === 'IMAGE'
              ? { type: 'IMAGE' }
              : { type: 'TXT' };
        return chunkPlainText(result.text, meta, sourceUrl);
      }
    }
  }

  private async extractContent(
    storagePath: string,
    mimeType: UploadsMime,
    orgId: DbId<'Org'>,
    onProgress?: (fraction: number) => Promise<void>
  ): Promise<ExtractionResult> {
    switch (mimeType) {
      case 'application/pdf':
        return this.pdfExtractor.extract(storagePath, onProgress);
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        return this.docxExtractor.extract(storagePath);
      case 'text/csv':
        return this.textExtractor.extractCsv(storagePath);
      case 'text/plain':
      case 'application/json':
        return this.textExtractor.extract(storagePath);
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel':
        return this.xlsxExtractor.extract(storagePath);
      case 'image/png':
      case 'image/jpeg':
      case 'image/webp':
      case 'image/gif':
        return this.imageExtractor.extract(storagePath, orgId);
      default: {
        const _exhaustive: never = mimeType;
        throw new Error(`Unsupported mime type: ${_exhaustive}`);
      }
    }
  }
}
