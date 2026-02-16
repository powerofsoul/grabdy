import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';

import { openai } from '@ai-sdk/openai';
import type { DbId } from '@grabdy/common';
import { extractOrgNumericId, packId } from '@grabdy/common';
import {
  AiCallerType,
  AiRequestType,
  type ChunkMeta,
  EMBEDDING_MODEL,
  UPLOADS_MIME_TO_TYPE,
  type UploadsMime,
} from '@grabdy/contracts';
import { embedMany } from 'ai';
import { Job } from 'bullmq';

import {
  CHUNK_OVERLAP,
  CHUNK_SIZE,
  EMBEDDING_BATCH_SIZE,
  SUMMARY_MAX_LENGTH,
} from '../../config/constants';
import { env } from '../../config/env.config';
import { DbService } from '../../db/db.module';
import { AiUsageService } from '../ai/ai-usage.service';
import { DocxExtractor } from '../extractors/docx.extractor';
import type {
  ExtractedImage,
  ExtractionResult,
  PageText,
  SheetData,
  SheetRow,
} from '../extractors/extractor.interface';
import { ImageExtractor } from '../extractors/image.extractor';
import { PdfExtractor } from '../extractors/pdf.extractor';
import { TextExtractor } from '../extractors/text.extractor';
import { XlsxExtractor } from '../extractors/xlsx.extractor';
import { DATA_SOURCE_QUEUE } from '../queue/queue.constants';
import type { FileStorage } from '../storage/file-storage.interface';
import { FILE_STORAGE } from '../storage/file-storage.interface';

export interface SyncedMessageData {
  content: string;
  metadata: ChunkMeta;
  sourceUrl: string;
}

export interface DataSourceJobData {
  dataSourceId: DbId<'DataSource'>;
  orgId: DbId<'Org'>;
  storagePath: string;
  mimeType: UploadsMime;
  collectionId: DbId<'Collection'> | null;
  /** Pre-extracted text content (used by integration sources to skip file extraction). */
  content?: string;
  /** Structured messages with per-message metadata (one chunk per message). Takes precedence over `content`. */
  messages?: SyncedMessageData[];
  /** Source URL for all chunks (used when all chunks share the same URL, e.g., a Jira issue). */
  sourceUrl?: string;
}

interface ChunkWithMeta {
  content: string;
  metadata: ChunkMeta;
  sourceUrl: string;
}

/** Build a preview URL for an uploaded data source. */
function previewUrl(dataSourceId: DbId<'DataSource'>, orgId: DbId<'Org'>): string {
  return `${env.frontendUrl}/dashboard/sources?preview=${dataSourceId}&org=${orgId}`;
}

function chunkText(text: string, metadata: ChunkMeta, sourceUrl: string): ChunkWithMeta[] {
  const chunks: ChunkWithMeta[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push({ content: text.slice(start, end), metadata, sourceUrl });
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

function chunkPagesText(
  pages: PageText[],
  metaType: 'PDF' | 'DOCX',
  sourceUrl: string
): ChunkWithMeta[] {
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
      metadata: { type: metaType, pages: pageNums },
      sourceUrl,
    });
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

function chunkSheets(sheets: SheetData[], sourceUrl: string): ChunkWithMeta[] {
  const chunks: ChunkWithMeta[] = [];
  for (const sheet of sheets) {
    let buffer = '';
    let startRow = sheet.rows[0]?.row ?? 1;
    for (const row of sheet.rows) {
      if (buffer.length + row.text.length > CHUNK_SIZE && buffer.length > 0) {
        chunks.push({
          content: buffer,
          metadata: { type: 'XLSX', sheet: sheet.sheet, row: startRow, columns: sheet.columns },
          sourceUrl,
        });
        buffer = '';
        startRow = row.row;
      }
      buffer += (buffer.length > 0 ? '\n' : '') + row.text;
    }
    if (buffer.length > 0) {
      chunks.push({
        content: buffer,
        metadata: { type: 'XLSX', sheet: sheet.sheet, row: startRow, columns: sheet.columns },
        sourceUrl,
      });
    }
  }
  return chunks;
}

function chunkCsvRows(rows: SheetRow[], columns: string[], sourceUrl: string): ChunkWithMeta[] {
  const chunks: ChunkWithMeta[] = [];
  let buffer = '';
  let startRow = rows[0]?.row ?? 1;
  for (const row of rows) {
    if (buffer.length + row.text.length > CHUNK_SIZE && buffer.length > 0) {
      chunks.push({
        content: buffer,
        metadata: { type: 'CSV', row: startRow, columns },
        sourceUrl,
      });
      buffer = '';
      startRow = row.row;
    }
    buffer += (buffer.length > 0 ? '\n' : '') + row.text;
  }
  if (buffer.length > 0) {
    chunks.push({
      content: buffer,
      metadata: { type: 'CSV', row: startRow, columns },
      sourceUrl,
    });
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
    private aiUsageService: AiUsageService
  ) {
    super();
  }

  async process(job: Job<DataSourceJobData>): Promise<void> {
    const { dataSourceId, orgId, storagePath, mimeType, collectionId } = job.data;
    this.logger.log(`Processing data source ${dataSourceId}`);

    const defaultSourceUrl = job.data.sourceUrl ?? previewUrl(dataSourceId, orgId);

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

      if (job.data.messages) {
        // Structured messages: one chunk per message with per-message metadata
        const msgs = job.data.messages.filter((m) => m.content.trim().length > 0);
        fullText = msgs.map((m) => m.content).join('\n');
        chunks = msgs.map((m) => ({
          content: m.content,
          metadata: m.metadata,
          sourceUrl: m.sourceUrl,
        }));
      } else if (job.data.content) {
        fullText = job.data.content;
        chunks = chunkText(fullText, { type: 'TXT' }, defaultSourceUrl);
      } else if (mimeType.startsWith('image/')) {
        // Image files get special handling: AI vision extracts description
        const meta = await this.imageExtractor.extractWithMetadata(storagePath, orgId);
        fullText = meta.text;
        chunks = chunkText(fullText, { type: 'IMAGE' }, defaultSourceUrl);
      } else {
        const result = await this.extractContent(storagePath, mimeType);
        fullText = result.text;
        chunks = this.chunksFromResult(result, defaultSourceUrl, mimeType);
        pageCount = result.type === 'pages' ? result.pages.length : null;

        // Store extracted images from documents (PDF, DOCX)
        if (
          (result.type === 'pages' || result.type === 'text') &&
          result.images &&
          result.images.length > 0
        ) {
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
        this.aiUsageService
          .logUsage(
            EMBEDDING_MODEL,
            embeddingUsage.tokens,
            0,
            AiCallerType.SYSTEM,
            AiRequestType.EMBEDDING,
            { orgId, source: 'SYSTEM' }
          )
          .catch((err) => this.logger.error(`Embedding usage logging failed: ${err}`));

        // Store chunks with embeddings
        const values = batch.map((chunk, idx) => ({
          id: packId('Chunk', orgId),
          content: chunk.content,
          chunk_index: i + idx,
          metadata: chunk.metadata,
          source_url: chunk.sourceUrl,
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

  private chunksFromResult(
    result: ExtractionResult,
    sourceUrl: string,
    mimeType: UploadsMime
  ): ChunkWithMeta[] {
    const dsType = UPLOADS_MIME_TO_TYPE[mimeType];

    switch (result.type) {
      case 'pages':
        return chunkPagesText(result.pages, dsType === 'DOCX' ? 'DOCX' : 'PDF', sourceUrl);
      case 'sheets':
        return chunkSheets(result.sheets, sourceUrl);
      case 'rows':
        return chunkCsvRows(result.rows, result.columns, sourceUrl);
      case 'text': {
        const meta: ChunkMeta =
          dsType === 'JSON'
            ? { type: 'JSON' }
            : dsType === 'IMAGE'
              ? { type: 'IMAGE' }
              : { type: 'TXT' };
        return chunkText(result.text, meta, sourceUrl);
      }
    }
  }

  private async storeExtractedImages(
    images: ExtractedImage[],
    dataSourceId: DbId<'DataSource'>,
    orgId: DbId<'Org'>
  ): Promise<void> {
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const ext = img.mimeType.split('/')[1] ?? 'png';
      const storagePath = `${orgId}/extracted/${dataSourceId}/${i}.${ext}`;

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

  private async extractContent(storagePath: string, mimeType: UploadsMime): Promise<ExtractionResult> {
    switch (mimeType) {
      case 'application/pdf':
        return this.pdfExtractor.extract(storagePath);
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
        return this.imageExtractor.extract(storagePath);
      default: {
        const _exhaustive: never = mimeType;
        throw new Error(`Unsupported mime type: ${_exhaustive}`);
      }
    }
  }
}
