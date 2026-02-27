import { Injectable, Logger } from '@nestjs/common';

import { type DbId, dbIdSchema } from '@grabdy/common';
import type { ChunkMeta } from '@grabdy/contracts';
import { isUploadsMime } from '@grabdy/contracts';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

import { PDF_PAGE_OVERLAP, PDF_PAGE_RANGE_SIZE } from '../../../../config/constants';
import { DbService } from '../../../../db/db.module';
import { S3FileStorage } from '../../../storage/s3-file-storage';
import type { ChunkWithMeta, SyncedMessageData } from '../../data-source.types';
import {
  chunkCsv,
  chunkPages,
  chunkPlainText,
  chunkSheets,
  groupMessages,
} from '../../services/chunking/chunk-content';
import { EmbeddingService } from '../../services/embedding.service';

import { CsvExtractor } from './extractors/csv.extractor';
import { DocxExtractor } from './extractors/docx.extractor';
import { ImageExtractor } from './extractors/image.extractor';
import { PdfExtractor } from './extractors/pdf.extractor';
import { TextExtractor } from './extractors/text.extractor';
import { XlsxExtractor } from './extractors/xlsx.extractor';

const execFileAsync = promisify(execFile);

@Injectable()
@Activity()
export class FileIngestionService {
  private readonly logger = new Logger(FileIngestionService.name);

  constructor(
    private db: DbService,
    private storage: S3FileStorage,
    private embeddingService: EmbeddingService,
    private pdfExtractor: PdfExtractor,
    private docxExtractor: DocxExtractor,
    private csvExtractor: CsvExtractor,
    private xlsxExtractor: XlsxExtractor,
    private textExtractor: TextExtractor,
    private imageExtractor: ImageExtractor
  ) {}

  @ActivityMethod()
  async extractContent(params: {
    dataSourceId: DbId<'DataSource'>;
    orgId: DbId<'Org'>;
    storagePath: string;
    mimeType: string;
    content?: string;
    messages?: SyncedMessageData[];
    sourceUrl?: string;
  }): Promise<{ chunks: ChunkWithMeta[]; pageCount?: number }> {
    const orgId = dbIdSchema('Org').parse(params.orgId);
    const mimeType = params.mimeType;

    const source = {
      sourceUrl: params.sourceUrl ?? null,
      sourceKey: params.storagePath || null,
    };

    // Messages take priority
    if (params.messages) {
      const msgs = params.messages.filter((m) => m.content.trim().length > 0);
      if (msgs.length === 0) throw new Error('No text content extracted');
      return { chunks: groupMessages(msgs) };
    }

    // Pre-extracted text content
    if (params.content) {
      if (!params.content.trim()) throw new Error('No text content extracted');
      const meta: ChunkMeta = mimeType === 'application/json' ? { type: 'JSON' } : { type: 'TXT' };
      return { chunks: chunkPlainText(params.content, meta, source) };
    }

    // File-based extraction (non-PDF)
    if (!isUploadsMime(mimeType)) {
      throw new Error(`Unsupported MIME type: ${mimeType}`);
    }

    // PDF extraction is handled by extractPdf activity
    if (mimeType === 'application/pdf') {
      throw new Error('PDF extraction should use the extractPdf activity');
    }

    const buffer = await this.storage.get(params.storagePath);

    switch (mimeType) {
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword': {
        const result = await this.docxExtractor.extract(buffer);
        if (result.type !== 'pages' || !result.text.trim()) {
          throw new Error('No text content extracted from file');
        }
        return {
          chunks: chunkPages(result.pages, 'DOCX', source),
          pageCount: result.pages.length,
        };
      }
      case 'text/csv': {
        const result = this.csvExtractor.extract(buffer);
        if (result.type !== 'rows' || !result.text.trim()) {
          throw new Error('No text content extracted from file');
        }
        return { chunks: chunkCsv(result.rows, result.columns, source) };
      }
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel': {
        const result = this.xlsxExtractor.extract(buffer);
        if (result.type !== 'sheets' || !result.text.trim()) {
          throw new Error('No text content extracted from file');
        }
        return { chunks: chunkSheets(result.sheets, source) };
      }
      case 'text/plain':
      case 'application/json': {
        const result = this.textExtractor.extract(buffer);
        if (!result.text.trim()) throw new Error('No text content extracted from file');
        const meta: ChunkMeta =
          mimeType === 'application/json' ? { type: 'JSON' } : { type: 'TXT' };
        return { chunks: chunkPlainText(result.text, meta, source) };
      }
      case 'image/png':
      case 'image/jpeg':
      case 'image/webp':
      case 'image/gif': {
        const result = await this.imageExtractor.extract(buffer, orgId);
        if (!result.text.trim()) throw new Error('No text content extracted from image');
        return { chunks: chunkPlainText(result.text, { type: 'IMAGE' }, source) };
      }
      default:
        throw new Error(`Unsupported MIME type for extraction: ${mimeType}`);
    }
  }

  /**
   * PDF-specific extraction that handles temp files, linearization,
   * and page-range-based extraction with overlap.
   */
  @ActivityMethod()
  async extractPdf(params: {
    dataSourceId: DbId<'DataSource'>;
    orgId: DbId<'Org'>;
    storagePath: string;
    collectionId: DbId<'Collection'> | null;
    appendOnly?: boolean;
  }): Promise<{ pageCount: number }> {
    const dataSourceId = dbIdSchema('DataSource').parse(params.dataSourceId);
    const orgId = dbIdSchema('Org').parse(params.orgId);
    const collectionId = params.collectionId
      ? dbIdSchema('Collection').parse(params.collectionId)
      : null;

    const source = {
      sourceUrl: null,
      sourceKey: params.storagePath,
    };

    const tempPdf = await this.storage.getTempPath(params.storagePath);

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
        await this.storage.put(params.storagePath, Buffer.from(linearizedBuf), 'application/pdf');
      } finally {
        await execFileAsync('rm', ['-f', linearizedPath]).catch(() => {});
      }

      let chunkIndexOffset = 0;
      if (!params.appendOnly) {
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

      await this.embeddingService.setProgress(dataSourceId, orgId, 2);

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
        const rangeChunks = textChunks.filter((c) => {
          const meta = c.metadata;
          if (meta.type !== 'PDF') return true;
          const minPage = Math.min(...meta.pages);
          return minPage >= range.start && minPage <= range.end;
        });

        if (rangeChunks.length > 0) {
          const rangeOffset = chunkIndexOffset + totalChunksStored;
          await this.embeddingService.embedAndStore(
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
        await this.embeddingService.setProgress(dataSourceId, orgId, rangeProgress);
      }

      if (totalChunksStored === 0) {
        throw new Error('No text content extracted from file');
      }

      this.logger.log(
        `PDF processed in ${ranges.length} range(s): ${totalChunksStored} chunks total`
      );

      return { pageCount };
    } finally {
      await tempPdf.cleanup();
    }
  }

  @ActivityMethod()
  async embedAndStore(params: {
    chunks: ChunkWithMeta[];
    chunkIndexOffset: number;
    dataSourceId: DbId<'DataSource'>;
    collectionId: DbId<'Collection'> | null;
    orgId: DbId<'Org'>;
    progressBase: number;
  }): Promise<void> {
    const dataSourceId = dbIdSchema('DataSource').parse(params.dataSourceId);
    const collectionId = params.collectionId
      ? dbIdSchema('Collection').parse(params.collectionId)
      : null;
    const orgId = dbIdSchema('Org').parse(params.orgId);

    await this.embeddingService.embedAndStore(
      params.chunks,
      params.chunkIndexOffset,
      dataSourceId,
      collectionId,
      orgId,
      params.progressBase
    );
  }

  @ActivityMethod()
  async updateDataSourceStatus(params: {
    dataSourceId: DbId<'DataSource'>;
    orgId: DbId<'Org'>;
    status: 'PROCESSING' | 'READY' | 'FAILED';
    pageCount?: number;
    progress?: number;
  }): Promise<void> {
    const dataSourceId = dbIdSchema('DataSource').parse(params.dataSourceId);
    const orgId = dbIdSchema('Org').parse(params.orgId);

    let query = this.db.kysely
      .updateTable('data.data_sources')
      .set({ status: params.status, updated_at: new Date() })
      .where('id', '=', dataSourceId)
      .where('org_id', '=', orgId);

    if (params.pageCount !== undefined) {
      query = query.set('page_count', params.pageCount);
    }
    if (params.progress !== undefined) {
      query = query.set('processing_progress', params.progress);
    }

    await query.execute();
  }

  @ActivityMethod()
  async deleteChunks(params: {
    dataSourceId: DbId<'DataSource'>;
    orgId: DbId<'Org'>;
  }): Promise<void> {
    const dataSourceId = dbIdSchema('DataSource').parse(params.dataSourceId);
    const orgId = dbIdSchema('Org').parse(params.orgId);

    await this.db.kysely
      .deleteFrom('data.chunks')
      .where('data_source_id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .execute();
  }

  @ActivityMethod()
  async getChunkOffset(params: {
    dataSourceId: DbId<'DataSource'>;
    orgId: DbId<'Org'>;
  }): Promise<number> {
    const dataSourceId = dbIdSchema('DataSource').parse(params.dataSourceId);
    const orgId = dbIdSchema('Org').parse(params.orgId);

    const maxRow = await this.db.kysely
      .selectFrom('data.chunks')
      .select(this.db.kysely.fn.max('chunk_index').as('max_index'))
      .where('data_source_id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();
    return maxRow?.max_index != null ? maxRow.max_index + 1 : 0;
  }
}
