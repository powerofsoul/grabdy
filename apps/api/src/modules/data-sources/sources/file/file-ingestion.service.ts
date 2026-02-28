import { Injectable, Logger } from '@nestjs/common';

import { type DbId, dbIdSchema } from '@grabdy/common';
import type { ChunkMeta } from '@grabdy/contracts';
import { isUploadsMime } from '@grabdy/contracts';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import pMap from 'p-map';

import { PDF_PAGE_OVERLAP, PDF_PAGE_RANGE_SIZE } from '../../../../config/constants';
import { DbService } from '../../../../db/db.module';
import { StorageKeys } from '../../../storage/file-storage.interface';
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
import { EnrichmentService } from '../../services/enrichment.service';
import { PipelineService } from '../../services/pipeline.service';

import { CsvExtractor } from './extractors/csv.extractor';
import { DocxExtractor, type DocxImage } from './extractors/docx.extractor';
import { ImageExtractor } from './extractors/image.extractor';
import { PdfExtractor } from './extractors/pdf.extractor';
import {
  insertTagsAtPositions,
  PdfAnnotationExtractor,
  type PositionedTag,
} from './extractors/pdf-annotation.extractor';
import { TextExtractor } from './extractors/text.extractor';
import { XlsxExtractor } from './extractors/xlsx.extractor';

const execFileAsync = promisify(execFile);

@Injectable()
export class FileIngestionService {
  private readonly logger = new Logger(FileIngestionService.name);

  constructor(
    private db: DbService,
    private storage: S3FileStorage,
    private embeddingService: EmbeddingService,
    private enrichmentService: EnrichmentService,
    private pipelineService: PipelineService,
    private pdfExtractor: PdfExtractor,
    private pdfAnnotationExtractor: PdfAnnotationExtractor,
    private docxExtractor: DocxExtractor,
    private csvExtractor: CsvExtractor,
    private xlsxExtractor: XlsxExtractor,
    private textExtractor: TextExtractor,
    private imageExtractor: ImageExtractor
  ) {}

  async extractContent(params: {
    dataSourceId: DbId<'DataSource'>;
    orgId: DbId<'Org'>;
    storagePath: string;
    mimeType: string;
    content?: string;
    messages?: SyncedMessageData[];
    sourceUrl?: string;
  }): Promise<{ chunks: ChunkWithMeta[]; pageCount?: number; images?: DocxImage[] }> {
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
        const [result, docxImages] = await Promise.all([
          this.docxExtractor.extract(buffer),
          this.docxExtractor.extractImages(buffer),
        ]);
        if (result.type !== 'pages' || !result.text.trim()) {
          throw new Error('No text content extracted from file');
        }
        return {
          chunks: chunkPages(result.pages, 'DOCX', source),
          pageCount: result.pages.length,
          images: docxImages.length > 0 ? docxImages : undefined,
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

  // ── PDF pipeline activities ──────────────────────────────────────

  /**
   * Single-activity PDF extraction: extract text, annotations, images,
   * vision descriptions, AI contextual summaries, and store chunks
   * WITHOUT embeddings (embedding is a separate resumable step).
   *
   * Uses per-page chunking with 3-page context window for AI summaries.
   */

  async extractAndChunkPdf(params: {
    dataSourceId: DbId<'DataSource'>;
    orgId: DbId<'Org'>;
    storagePath: string;
    collectionId: DbId<'Collection'> | null;
    appendOnly?: boolean;
    filename?: string;
  }): Promise<{ pageCount: number }> {
    const dataSourceId = dbIdSchema('DataSource').parse(params.dataSourceId);
    const orgId = dbIdSchema('Org').parse(params.orgId);
    const collectionId = params.collectionId
      ? dbIdSchema('Collection').parse(params.collectionId)
      : null;

    const source = { sourceUrl: null, sourceKey: params.storagePath };
    const tempPdf = await this.storage.getTempPath(params.storagePath);
    const dsLabel = `[PDF ds=${dataSourceId}]`;

    try {
      const pageCount = await this.pdfExtractor.getPageCountFromFile(tempPdf.path);
      this.logger.debug(
        `${dsLabel} Page count: ${pageCount}, file: ${params.filename ?? params.storagePath}`
      );
      if (pageCount === 0) {
        throw new Error('No text content extracted from file');
      }

      // Linearize for efficient byte-range serving
      this.logger.debug(`${dsLabel} Linearizing PDF...`);
      const linearizedPath = `${tempPdf.path}-linearized.pdf`;
      try {
        await execFileAsync('qpdf', ['--linearize', tempPdf.path, linearizedPath]);
        const linearizedBuf = await readFile(linearizedPath);
        await this.storage.put(params.storagePath, Buffer.from(linearizedBuf), 'application/pdf');
        this.logger.debug(`${dsLabel} Linearized and re-uploaded`);
      } finally {
        await execFileAsync('rm', ['-f', linearizedPath]).catch(() => {});
      }

      // Handle append mode
      let chunkIndexOffset = 0;
      if (!params.appendOnly) {
        await this.db.kysely
          .deleteFrom('data.chunks')
          .where('data_source_id', '=', dataSourceId)
          .where('org_id', '=', orgId)
          .execute();
        this.logger.debug(`${dsLabel} Deleted existing chunks (full re-index)`);
      } else {
        const maxRow = await this.db.kysely
          .selectFrom('data.chunks')
          .select(this.db.kysely.fn.max('chunk_index').as('max_index'))
          .where('data_source_id', '=', dataSourceId)
          .where('org_id', '=', orgId)
          .executeTakeFirst();
        chunkIndexOffset = maxRow?.max_index != null ? maxRow.max_index + 1 : 0;
        this.logger.debug(`${dsLabel} Append mode, starting at chunk index ${chunkIndexOffset}`);
      }

      await this.embeddingService.setProgress(dataSourceId, orgId, 2);

      // ── Phase 1: Extract, enrich, chunk per range (0-30%) ──

      this.logger.debug(`${dsLabel} Extracting annotations and outline...`);
      const pdfBuffer = await readFile(tempPdf.path);
      const [annotationsMap, outline] = await Promise.all([
        this.pdfAnnotationExtractor.extractAnnotations(pdfBuffer),
        this.pdfAnnotationExtractor.extractOutline(pdfBuffer),
      ]);
      this.logger.debug(
        `${dsLabel} Annotations: ${annotationsMap.size} pages with annotations, outline: ${outline.length} headings`
      );

      const ranges: Array<{ start: number; end: number }> = [];
      for (let start = 1; start <= pageCount; start += PDF_PAGE_RANGE_SIZE) {
        ranges.push({ start, end: Math.min(start + PDF_PAGE_RANGE_SIZE - 1, pageCount) });
      }
      this.logger.debug(
        `${dsLabel} Processing ${ranges.length} range(s): ${ranges.map((r) => `${r.start}-${r.end}`).join(', ')}`
      );

      const allChunks: ChunkWithMeta[] = [];
      let completedRanges = 0;

      await pMap(
        ranges,
        async (range) => {
          const rangeLabel = `${range.start}-${range.end}`;
          const extractStart = Math.max(1, range.start - PDF_PAGE_OVERLAP);
          const extractEnd = Math.min(pageCount, range.end + PDF_PAGE_OVERLAP);
          this.logger.debug(
            `${dsLabel} Range ${rangeLabel}: extracting ${extractStart}-${extractEnd} with overlap`
          );

          // Extract text, word positions, and images in parallel
          const [pages, wordPositionsMap, extractedImages] = await Promise.all([
            this.pdfAnnotationExtractor.extractPageRangeFromFile(
              tempPdf.path,
              extractStart,
              extractEnd
            ),
            this.pdfAnnotationExtractor.extractWordPositions(
              tempPdf.path,
              extractStart,
              extractEnd
            ),
            this.pdfAnnotationExtractor.extractImages(
              tempPdf.path,
              range.start,
              range.end,
              pdfBuffer
            ),
          ]);
          this.logger.debug(
            `${dsLabel}   [${rangeLabel}] Extracted text for ${pages.length} pages, ${extractedImages.length} images, word positions for ${wordPositionsMap.size} pages`
          );

          // Collect annotation tags per page and image descriptions concurrently
          const pageAnnotationTags = new Map<number, PositionedTag[]>();
          const annotationTagsPromise = Promise.all(
            pages.map(async (p) => {
              const pageAnnotations = annotationsMap.get(p.page);
              if (!pageAnnotations) {
                this.logger.debug(
                  `${dsLabel}   Page ${p.page}: ${p.text.length} chars, no annotations`
                );
                return;
              }

              const pageWords = wordPositionsMap.get(p.page) ?? [];
              const { height: pageHeight } = await this.pdfAnnotationExtractor.getPageDimensions(
                tempPdf.path,
                p.page
              );

              const tags = this.pdfAnnotationExtractor.getAnnotationTags(
                pageAnnotations,
                pageWords,
                pageHeight
              );
              if (tags.length > 0) {
                pageAnnotationTags.set(p.page, tags);
                this.logger.debug(
                  `${dsLabel}   Page ${p.page}: ${tags.length} annotation tags (${tags.filter((t) => t.yPosition !== undefined).length} positioned)`
                );
              }
            })
          );

          // Start image descriptions in parallel with annotation tag extraction
          const imageDescriptionsPromise =
            extractedImages.length > 0
              ? (async () => {
                  this.logger.debug(
                    `${dsLabel}   [${rangeLabel}] Describing ${extractedImages.length} images via vision API...`
                  );
                  const rawPages = new Map(pages.map((p) => [p.page, p.text]));
                  return this.enrichmentService.describeImages({
                    orgId,
                    images: extractedImages.map((img) => ({
                      buffer: img.buffer,
                      page: img.page,
                      width: img.width,
                      height: img.height,
                      surroundingText: (rawPages.get(img.page) ?? '').slice(0, 500),
                    })),
                  });
                })()
              : Promise.resolve(null);

          const [, imageDescriptions] = await Promise.all([
            annotationTagsPromise,
            imageDescriptionsPromise,
          ]);

          // Store images and collect image tags
          const pageImageIds = new Map<number, Array<DbId<'ExtractedImage'>>>();
          const pageImageTags = new Map<number, PositionedTag[]>();

          if (extractedImages.length > 0 && imageDescriptions) {
            const describedCount = imageDescriptions.filter((d) => d?.description?.trim()).length;
            this.logger.debug(
              `${dsLabel}   [${rangeLabel}] Vision returned ${describedCount}/${extractedImages.length} descriptions`
            );

            const imageIds = await this.pipelineService.storeExtractedImages({
              images: extractedImages.map((img, idx) => ({
                buffer: img.buffer,
                mimeType: 'image/png',
                pageNumber: img.page,
                width: img.width,
                height: img.height,
                aiDescription: imageDescriptions[idx]?.description,
              })),
              dataSourceId,
              orgId,
              storagePrefix: StorageKeys.extractedImages(orgId, dataSourceId),
            });
            this.logger.debug(
              `${dsLabel}   [${rangeLabel}] Stored ${imageIds.length} images to S3`
            );

            for (let i = 0; i < extractedImages.length; i++) {
              const page = extractedImages[i].page;
              const imageId = imageIds[i];

              const existing = pageImageIds.get(page) ?? [];
              existing.push(imageId);
              pageImageIds.set(page, existing);

              const desc = imageDescriptions[i]?.description ?? '';
              if (desc.trim()) {
                const imgTags = pageImageTags.get(page) ?? [];
                imgTags.push({
                  tag: `[IMAGE: ${desc}]`,
                  yPosition: extractedImages[i].yPosition,
                });
                pageImageTags.set(page, imgTags);
              }
            }
          }

          // Insert all annotations + image descriptions at correct positions in one pass
          const enrichedPages = pages.map((p) => {
            const annotationTags = pageAnnotationTags.get(p.page) ?? [];
            const imageTags = pageImageTags.get(p.page) ?? [];
            const allTags = [...annotationTags, ...imageTags];
            if (allTags.length === 0) return p;

            const pageWords = wordPositionsMap.get(p.page) ?? [];
            const enrichedText = insertTagsAtPositions(p.text, allTags, pageWords);
            this.logger.debug(
              `${dsLabel}   Page ${p.page}: ${p.text.length} -> ${enrichedText.length} chars (${allTags.length} tags inserted)`
            );
            return { page: p.page, text: enrichedText };
          });

          // Chunk this range's enriched pages (with overlap for cross-page context)
          const textChunks =
            enrichedPages.length > 0 ? chunkPages(enrichedPages, 'PDF', source) : [];

          // Filter to only keep chunks starting in the target range (not overlap pages)
          const rangeChunks = textChunks.filter((c) => {
            const meta = c.metadata;
            if (meta.type !== 'PDF') return true;
            const minPage = Math.min(...meta.pages);
            return minPage >= range.start && minPage <= range.end;
          });
          this.logger.debug(
            `${dsLabel}   [${rangeLabel}] Chunked: ${textChunks.length} raw, ${rangeChunks.length} after overlap filter`
          );

          // Link extracted_image_id to chunks based on page
          for (const chunk of rangeChunks) {
            if (chunk.metadata.type === 'PDF') {
              for (const page of chunk.metadata.pages) {
                const ids = pageImageIds.get(page);
                if (ids && ids.length > 0) {
                  chunk.extractedImageId = ids[0];
                  break;
                }
              }
            }
          }

          allChunks.push(...rangeChunks);

          completedRanges++;
          const extractProgress = 2 + Math.round((completedRanges / ranges.length) * 28);
          await this.embeddingService.setProgress(dataSourceId, orgId, extractProgress);
          this.logger.debug(
            `${dsLabel}   [${rangeLabel}] Range done, progress: ${extractProgress}%`
          );
        },
        { concurrency: 3 }
      );

      if (allChunks.length === 0) {
        throw new Error('No text content extracted from file');
      }

      // pMap runs ranges concurrently, so chunks may be in non-deterministic order.
      // Sort by first page number to ensure consistent chunk ordering.
      allChunks.sort((a, b) => {
        const aPage = a.metadata.type === 'PDF' ? Math.min(...a.metadata.pages) : 0;
        const bPage = b.metadata.type === 'PDF' ? Math.min(...b.metadata.pages) : 0;
        return aPage - bPage;
      });

      this.logger.debug(
        `${dsLabel} Phase 1 complete: ${allChunks.length} chunks from ${pageCount} pages`
      );
      await this.embeddingService.setProgress(dataSourceId, orgId, 30);

      // ── Phase 2: Generate AI contextual descriptions (30-50%) ──

      this.logger.debug(
        `${dsLabel} Phase 2: Generating AI contextual descriptions for ${allChunks.length} chunks...`
      );

      const docSummary = allChunks
        .slice(0, 5)
        .map((c) => c.content)
        .join('\n')
        .slice(0, 2000);

      const chunkData = allChunks.map((c) => {
        const pages = c.metadata.type === 'PDF' ? c.metadata.pages : [];
        return { content: c.content, pageNumber: pages[0] ?? 1 };
      });

      const contexts = await this.enrichmentService.generateChunkContexts({
        orgId,
        chunks: chunkData,
        documentSummary: docSummary,
        filename: params.filename ?? '',
      });
      const contextCount = contexts.filter((c) => c.context.trim()).length;
      this.logger.debug(
        `${dsLabel} AI contexts generated: ${contextCount}/${allChunks.length} non-empty`
      );

      // Build embedding context: filename + outline + page + AI context + questions
      for (let i = 0; i < allChunks.length; i++) {
        const chunk = allChunks[i];
        const pages = chunk.metadata.type === 'PDF' ? chunk.metadata.pages : [];
        const pageNum = pages[0] ?? 1;

        const lines: string[] = [];
        if (params.filename) {
          lines.push(`Document: ${params.filename}`);
        }

        const activeHeadings: Array<{ title: string; level: number }> = [];
        for (const h of outline) {
          if (h.page > pageNum) break;
          while (
            activeHeadings.length > 0 &&
            activeHeadings[activeHeadings.length - 1].level >= h.level
          ) {
            activeHeadings.pop();
          }
          activeHeadings.push({ title: h.title, level: h.level });
        }
        if (activeHeadings.length > 0) {
          lines.push(`Section: ${activeHeadings.map((h) => h.title).join(' > ')}`);
        }

        lines.push(`Page: ${pageNum}`);

        const ctx = contexts[i];
        if (ctx && ctx.context) {
          lines.push(`Context: ${ctx.context}`);
        }
        if (ctx && ctx.questions.length > 0) {
          lines.push(`Questions: ${ctx.questions.join(' | ')}`);
        }

        lines.push('---');
        allChunks[i] = { ...chunk, embeddingContext: lines.join('\n') + '\n' };
      }

      this.logger.debug(`${dsLabel} Embedding contexts built for all ${allChunks.length} chunks`);
      await this.embeddingService.setProgress(dataSourceId, orgId, 50);

      // ── Phase 3: Embed and store all chunks (50-100%) ──

      this.logger.debug(`${dsLabel} Phase 3: Embedding and storing ${allChunks.length} chunks...`);
      await this.embeddingService.embedAndStore(
        allChunks,
        chunkIndexOffset,
        dataSourceId,
        collectionId,
        orgId,
        50
      );

      this.logger.log(
        `${dsLabel} Complete: ${pageCount} pages, ${ranges.length} range(s), ${allChunks.length} chunks`
      );

      return { pageCount };
    } finally {
      await tempPdf.cleanup();
    }
  }
}
