import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';

import { openai } from '@ai-sdk/openai';
import type { DbId } from '@grabdy/common';
import { packId } from '@grabdy/common';
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
  CHUNK_OVERLAP_TOKENS,
  CHUNK_SIZE_TOKENS,
  EMBEDDING_BATCH_SIZE,
  MIN_CHUNK_SIZE_TOKENS,
} from '../../config/constants';
import { env } from '../../config/env.config';
import { DbService } from '../../db/db.module';
import { AiUsageService } from '../ai/ai-usage.service';
import { DocxExtractor } from '../extractors/docx.extractor';
import type {
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

import { splitText } from './chunking/recursive-text-splitter';
import { countTokens, decodeTokens, encodeTokens } from './chunking/tokenizer';

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
  /** When true, append new chunks to existing data source without deleting old ones. */
  appendOnly?: boolean;
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
  const segments = splitText(text, {
    maxSizeTokens: CHUNK_SIZE_TOKENS,
    overlapTokens: CHUNK_OVERLAP_TOKENS,
    minSizeTokens: MIN_CHUNK_SIZE_TOKENS,
  });
  return segments.map((content) => ({ content, metadata, sourceUrl }));
}

/**
 * Check if two ChunkMeta objects represent the same grouping context.
 * Messages with the same context can be grouped into a single chunk.
 * For Slack, messages from the same channel are grouped regardless of author
 * — all unique authors are collected into the chunk's `slackAuthors` array.
 */
function isSameGroupingContext(a: ChunkMeta, b: ChunkMeta): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'SLACK' && b.type === 'SLACK') {
    return a.slackChannelId === b.slackChannelId;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Merge authors from a message into a SLACK chunk's metadata.
 * Collects unique authors across all grouped messages.
 */
function mergeSlackAuthors(chunkMeta: ChunkMeta, messageMeta: ChunkMeta): ChunkMeta {
  if (chunkMeta.type !== 'SLACK' || messageMeta.type !== 'SLACK') return chunkMeta;
  const existing = new Set(chunkMeta.slackAuthors);
  for (const author of messageMeta.slackAuthors) {
    existing.add(author);
  }
  return { ...chunkMeta, slackAuthors: [...existing] };
}

/**
 * Group consecutive messages into conversation-window chunks up to CHUNK_SIZE_TOKENS.
 * Messages from the same context (e.g., same Slack channel) are grouped together,
 * collecting all unique authors into the chunk's metadata.
 * Oversized individual messages are split using the recursive text splitter.
 */
function groupMessages(msgs: SyncedMessageData[]): ChunkWithMeta[] {
  if (msgs.length === 0) return [];

  const chunks: ChunkWithMeta[] = [];
  let buffer = '';
  let bufferTokens = 0;
  let chunkMeta: ChunkMeta = msgs[0].metadata;
  let anchorUrl: string = msgs[0].sourceUrl;

  for (const msg of msgs) {
    const contextChanged = !isSameGroupingContext(chunkMeta, msg.metadata);
    const separator = buffer.length > 0 ? '\n' : '';
    const candidateTokens = countTokens(separator + msg.content);

    if (
      (bufferTokens + candidateTokens > CHUNK_SIZE_TOKENS || contextChanged) &&
      buffer.length > 0
    ) {
      // Flush current buffer as a chunk
      chunks.push({ content: buffer, metadata: chunkMeta, sourceUrl: anchorUrl });
      buffer = '';
      bufferTokens = 0;
      chunkMeta = msg.metadata;
      anchorUrl = msg.sourceUrl;
    } else {
      // Merge authors from this message into the chunk metadata
      chunkMeta = mergeSlackAuthors(chunkMeta, msg.metadata);
    }

    buffer += separator + msg.content;
    bufferTokens = countTokens(buffer);

    // If a single message exceeds CHUNK_SIZE_TOKENS, flush and split it
    if (bufferTokens > CHUNK_SIZE_TOKENS) {
      chunks.push(...chunkText(buffer, chunkMeta, anchorUrl));
      buffer = '';
      bufferTokens = 0;
      chunkMeta = msg.metadata;
      anchorUrl = msg.sourceUrl;
    }
  }

  if (buffer.length > 0) {
    if (bufferTokens >= MIN_CHUNK_SIZE_TOKENS) {
      chunks.push({ content: buffer, metadata: chunkMeta, sourceUrl: anchorUrl });
    } else if (chunks.length > 0) {
      // Append undersized tail to the last chunk and merge authors
      const last = chunks[chunks.length - 1];
      chunks[chunks.length - 1] = {
        ...last,
        content: last.content + '\n' + buffer,
        metadata: mergeSlackAuthors(last.metadata, chunkMeta),
      };
    } else {
      // Only chunk — keep it regardless of size
      chunks.push({ content: buffer, metadata: chunkMeta, sourceUrl: anchorUrl });
    }
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

  // Split WITHOUT overlap first so we can accurately track positions
  const baseSegments = splitText(fullText, {
    maxSizeTokens: CHUNK_SIZE_TOKENS,
    overlapTokens: 0,
    minSizeTokens: MIN_CHUNK_SIZE_TOKENS,
  });

  // Segments are contiguous (no overlap) — track offset cumulatively
  const chunks: ChunkWithMeta[] = [];
  let offset = 0;

  for (let i = 0; i < baseSegments.length; i++) {
    const base = baseSegments[i];
    const start = offset;
    const end = start + base.length;

    // Apply overlap: prepend tail of previous segment (token-aware)
    let content = base;
    let overlapLen = 0;
    if (i > 0 && CHUNK_OVERLAP_TOKENS > 0) {
      const prev = baseSegments[i - 1];
      const prevTokens = encodeTokens(prev);
      const overlapStart = Math.max(0, prevTokens.length - CHUNK_OVERLAP_TOKENS);
      const overlapText = decodeTokens(prevTokens.slice(overlapStart));
      content = overlapText + base;
      overlapLen = overlapText.length;
    }

    // Find which pages this chunk spans (including the overlap region)
    const contentStart = start - overlapLen;
    const pageSet = new Set<number>();
    for (const b of boundaries) {
      const pageIdx = b.page - 1;
      const pageLen = pages[pageIdx]?.text.length ?? 0;
      const pageStart = b.offset;
      const pageEnd = pageStart + pageLen;
      if (pageStart < end && pageEnd > contentStart) {
        pageSet.add(b.page);
      }
    }

    const pageNums = [...pageSet].sort((a, b) => a - b);
    chunks.push({
      content,
      metadata: { type: metaType, pages: pageNums },
      sourceUrl,
    });

    offset = end;
  }

  return chunks;
}

function chunkSheets(sheets: SheetData[], sourceUrl: string): ChunkWithMeta[] {
  const chunks: ChunkWithMeta[] = [];
  for (const sheet of sheets) {
    let buffer = '';
    let bufferTokens = 0;
    let startRow = sheet.rows[0]?.row ?? 1;
    for (const row of sheet.rows) {
      const rowTokens = countTokens(row.text);
      if (bufferTokens + rowTokens > CHUNK_SIZE_TOKENS && buffer.length > 0) {
        chunks.push({
          content: buffer,
          metadata: { type: 'XLSX', sheet: sheet.sheet, row: startRow, columns: sheet.columns },
          sourceUrl,
        });
        buffer = '';
        bufferTokens = 0;
        startRow = row.row;
      }
      buffer += (buffer.length > 0 ? '\n' : '') + row.text;
      bufferTokens += rowTokens + (bufferTokens > 0 ? 1 : 0); // +1 for newline token
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
  let bufferTokens = 0;
  let startRow = rows[0]?.row ?? 1;
  for (const row of rows) {
    const rowTokens = countTokens(row.text);
    if (bufferTokens + rowTokens > CHUNK_SIZE_TOKENS && buffer.length > 0) {
      chunks.push({
        content: buffer,
        metadata: { type: 'CSV', row: startRow, columns },
        sourceUrl,
      });
      buffer = '';
      bufferTokens = 0;
      startRow = row.row;
    }
    buffer += (buffer.length > 0 ? '\n' : '') + row.text;
    bufferTokens += rowTokens + (bufferTokens > 0 ? 1 : 0);
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
    private aiUsageService: AiUsageService
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

      if (job.data.messages) {
        // Group consecutive messages into conversation-window chunks
        const msgs = job.data.messages.filter((m) => m.content.trim().length > 0);
        fullText = msgs.map((m) => m.content).join('\n');
        chunks = groupMessages(msgs);
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
      }

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
          chunk_index: chunkIndexOffset + i + idx,
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

  private async extractContent(
    storagePath: string,
    mimeType: UploadsMime
  ): Promise<ExtractionResult> {
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
