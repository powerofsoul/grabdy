import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';

import { openai } from '@ai-sdk/openai';
import type { DbId } from '@grabdy/common';
import { extractOrgNumericId, packId } from '@grabdy/common';
import { EMBEDDING_MODEL } from '@grabdy/contracts';
import { embedMany } from 'ai';
import { Job } from 'bullmq';

import {
  CHUNK_OVERLAP,
  CHUNK_SIZE,
  EMBEDDING_BATCH_SIZE,
  SUMMARY_MAX_LENGTH,
} from '../../../config/constants';
import { DbService } from '../../../db/db.module';
import { AiCallerType, AiRequestType } from '../../../db/enums';
import { AiUsageService } from '../../ai/ai-usage.service';
import { DocxExtractor } from '../../extractors/docx.extractor';
import type {
  ExtractedImage,
  ExtractionResult,
  PageText,
} from '../../extractors/extractor.interface';
import { ImageExtractor } from '../../extractors/image.extractor';
import { PdfExtractor } from '../../extractors/pdf.extractor';
import { TextExtractor } from '../../extractors/text.extractor';
import { XlsxExtractor } from '../../extractors/xlsx.extractor';
import type { FileStorage } from '../../storage/file-storage.interface';
import { FILE_STORAGE } from '../../storage/file-storage.interface';
import { DATA_SOURCE_QUEUE } from '../queue.constants';

export interface DataSourceJobData {
  dataSourceId: DbId<'DataSource'>;
  orgId: DbId<'Org'>;
  storagePath: string;
  mimeType: string;
  collectionId: DbId<'Collection'> | null;
  /** Pre-extracted text content (used by integration sources to skip file extraction). */
  content?: string;
}

interface ChunkWithMeta {
  content: string;
  metadata: { pages?: number[] } | null;
}

function chunkText(text: string): ChunkWithMeta[] {
  const chunks: ChunkWithMeta[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push({ content: text.slice(start, end), metadata: null });
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

function chunkPagesText(pages: PageText[]): ChunkWithMeta[] {
  // Build a flat string with page boundary tracking
  const boundaries: Array<{ offset: number; page: number }> = [];
  let fullText = '';

  for (const p of pages) {
    boundaries.push({ offset: fullText.length, page: p.page });
    fullText += p.text;
  }

  const chunks: ChunkWithMeta[] = [];
  let start = 0;
  while (start < fullText.length) {
    const end = Math.min(start + CHUNK_SIZE, fullText.length);

    // Find which pages this chunk spans
    const pageSet = new Set<number>();
    for (const b of boundaries) {
      const pageIdx = b.page - 1;
      const pageLen = pages[pageIdx]?.text.length ?? 0;
      const pageStart = b.offset;
      const pageEnd = pageStart + pageLen;
      // Overlap check: chunk [start, end) overlaps page [pageStart, pageEnd)
      if (pageStart < end && pageEnd > start) {
        pageSet.add(b.page);
      }
    }

    const pageNums = [...pageSet].sort((a, b) => a - b);
    chunks.push({
      content: fullText.slice(start, end),
      metadata: pageNums.length > 0 ? { pages: pageNums } : null,
    });
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

@Processor(DATA_SOURCE_QUEUE, { concurrency: 25 })
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
    private aiUsageService: AiUsageService,
  ) {
    super();
  }

  async process(job: Job<DataSourceJobData>): Promise<void> {
    const { dataSourceId, orgId, storagePath, mimeType, collectionId } = job.data;
    this.logger.log(`Processing data source ${dataSourceId}`);

    try {
      // Update status to PROCESSING
      await this.db.kysely
        .updateTable('data.data_sources')
        .set({ status: 'PROCESSING', updated_at: new Date() })
        .where('id', '=', dataSourceId)
        .execute();

      // Extract content: use pre-extracted for integration sources, otherwise read from storage
      let chunks: ChunkWithMeta[];
      let fullText: string;
      let pageCount: number | null = null;

      if (job.data.content) {
        fullText = job.data.content;
        chunks = chunkText(fullText);
      } else if (mimeType.startsWith('image/')) {
        // Image files get special handling: AI vision extracts description + tags
        const meta = await this.imageExtractor.extractWithMetadata(storagePath, orgId);
        fullText = meta.text;
        chunks = chunkText(fullText);

        // Store AI metadata on the data source
        await this.db.kysely
          .updateTable('data.data_sources')
          .set({
            ai_tags: meta.aiTags,
            ai_description: meta.aiDescription,
          })
          .where('id', '=', dataSourceId)
          .execute();
      } else {
        const result = await this.extractContent(storagePath, mimeType);
        fullText = result.text;
        pageCount = result.pages?.length ?? null;
        chunks =
          result.pages && result.pages.length > 0
            ? chunkPagesText(result.pages)
            : chunkText(fullText);

        // Store extracted images from documents (PDF, DOCX)
        if (result.images && result.images.length > 0) {
          await this.storeExtractedImages(result.images, dataSourceId, orgId);
        }
      }

      if (!fullText.trim()) {
        throw new Error('No text content extracted from file');
      }

      this.logger.log(`Split into ${chunks.length} chunks`);

      // Generate embeddings in batches
      const batchSize = EMBEDDING_BATCH_SIZE;

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);

        const { embeddings, usage: embeddingUsage } = await embedMany({
          model: openai.embedding('text-embedding-3-small'),
          values: batch.map((c) => c.content),
        });

        // Log embedding usage
        this.aiUsageService.logUsage(
          EMBEDDING_MODEL,
          embeddingUsage.tokens,
          0,
          AiCallerType.SYSTEM,
          AiRequestType.EMBEDDING,
          { orgId },
        ).catch((err) => this.logger.error(`Embedding usage logging failed: ${err}`));

        // Store chunks with embeddings
        const values = batch.map((chunk, idx) => ({
          id: packId('Chunk', orgId),
          content: chunk.content,
          chunk_index: i + idx,
          metadata: chunk.metadata,
          embedding: `[${embeddings[idx].join(',')}]`,
          data_source_id: dataSourceId,
          collection_id: collectionId,
          org_id: orgId,
        }));

        await this.db.kysely.insertInto('data.chunks').values(values).execute();

        await job.updateProgress(Math.min(((i + batchSize) / chunks.length) * 100, 100));
      }

      // Update data source status to READY
      await this.db.kysely
        .updateTable('data.data_sources')
        .set({
          status: 'READY',
          page_count: pageCount ?? chunks.length,
          summary: fullText.slice(0, SUMMARY_MAX_LENGTH),
          updated_at: new Date(),
        })
        .where('id', '=', dataSourceId)
        .execute();

      this.logger.log(`Data source ${dataSourceId} processed successfully`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process data source ${dataSourceId}: ${message}`);

      await this.db.kysely
        .updateTable('data.data_sources')
        .set({ status: 'FAILED', updated_at: new Date() })
        .where('id', '=', dataSourceId)
        .execute();

      throw error;
    }
  }

  private async storeExtractedImages(
    images: ExtractedImage[],
    dataSourceId: DbId<'DataSource'>,
    orgId: DbId<'Org'>
  ): Promise<void> {
    const orgNum = extractOrgNumericId(orgId).toString();

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const ext = img.mimeType.split('/')[1] ?? 'png';
      const storagePath = `${orgNum}/extracted/${dataSourceId}/${i}.${ext}`;

      await this.storage.put(storagePath, img.buffer, img.mimeType);

      await this.db.kysely
        .insertInto('data.extracted_images')
        .values({
          id: packId('ExtractedImage', orgId),
          data_source_id: dataSourceId,
          storage_path: storagePath,
          mime_type: img.mimeType,
          page_number: img.pageNumber ?? null,
          org_id: orgId,
        })
        .execute();
    }

    this.logger.log(`Stored ${images.length} extracted images for ${dataSourceId}`);
  }

  private async extractContent(storagePath: string, mimeType: string): Promise<ExtractionResult> {
    if (mimeType === 'application/pdf') {
      return this.pdfExtractor.extract(storagePath);
    }
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return this.docxExtractor.extract(storagePath);
    }
    if (mimeType === 'text/csv' || mimeType === 'text/plain' || mimeType === 'application/json') {
      return this.textExtractor.extract(storagePath);
    }
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel'
    ) {
      return this.xlsxExtractor.extract(storagePath);
    }
    if (mimeType.startsWith('image/')) {
      return this.imageExtractor.extract(storagePath);
    }
    throw new Error(`Unsupported mime type: ${mimeType}`);
  }
}
