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
import { embedMany, generateText } from 'ai';

import { EMBEDDING_BATCH_SIZE } from '../../config/constants';
import { env } from '../../config/env.config';
import { DbService } from '../../db/db.module';
import { inngest, type InngestStepTools } from '../../inngest/inngest.client';
import { InngestFunctions } from '../../inngest/inngest.decorator';
import { InngestService } from '../../inngest/inngest.service';
import { AiUsageService } from '../ai/ai-usage.service';
import { DocxExtractor } from '../extractors/docx.extractor';
import type { ExtractionResult } from '../extractors/extractor.interface';
import { PdfExtractor } from '../extractors/pdf.extractor';
import { TextExtractor } from '../extractors/text.extractor';
import { XlsxExtractor } from '../extractors/xlsx.extractor';
import type { FileStorage } from '../storage/file-storage.interface';
import { FILE_STORAGE } from '../storage/file-storage.interface';

import {
  chunkCsv,
  chunkPages,
  chunkPlainText,
  chunkSheets,
  groupMessages,
} from './chunking/chunk-content';
import type { ChunkWithMeta } from './data-source.types';

function previewUrl(dataSourceId: DbId<'DataSource'>, orgId: DbId<'Org'>): string {
  return `${env.frontendUrl}/dashboard/sources?preview=${dataSourceId}&org=${orgId}`;
}

@InngestFunctions()
export class DataSourceFunctions {
  private readonly logger = new Logger(DataSourceFunctions.name);

  constructor(
    private db: DbService,
    @Inject(FILE_STORAGE) private storage: FileStorage,
    private pdfExtractor: PdfExtractor,
    private docxExtractor: DocxExtractor,
    private textExtractor: TextExtractor,
    private xlsxExtractor: XlsxExtractor,
    private aiUsageService: AiUsageService,
    private inngestService: InngestService
  ) {}

  definitions() {
    return [this.processDataSource(), this.cleanupDataSource(), this.maintenanceStaleProcessing()];
  }

  private processDataSource() {
    return inngest.createFunction(
      {
        id: 'process-data-source',
        concurrency: [
          { scope: 'fn', limit: 25 },
          { scope: 'fn', key: 'event.data.orgId', limit: 5 },
        ],
        retries: 3,
        onFailure: async ({ event }) => {
          const { dataSourceId, orgId } = event.data.event.data;
          await this.db.kysely
            .updateTable('data.data_sources')
            .set({ status: 'FAILED', updated_at: new Date() })
            .where('id', '=', dataSourceId)
            .where('org_id', '=', orgId)
            .execute();
        },
      },
      { event: 'app/data-source.process' },
      async ({ event, step }) => {
        const { dataSourceId, orgId, storagePath, mimeType, collectionId } = event.data;
        const defaultSourceUrl = event.data.sourceUrl ?? previewUrl(dataSourceId, orgId);
        const isAppendOnly = Boolean(event.data.appendOnly);

        // Step 1: Set status to PROCESSING
        if (!isAppendOnly) {
          await step.run('set-processing', async () => {
            await this.db.kysely
              .updateTable('data.data_sources')
              .set({ status: 'PROCESSING', updated_at: new Date() })
              .where('id', '=', dataSourceId)
              .where('org_id', '=', orgId)
              .execute();
          });
        }

        // Step 2: Extract content
        // Images need a separate step for the vision AI call
        const isImage = mimeType.startsWith('image/');

        const extracted = isImage
          ? await this.extractImage(step, storagePath, orgId, defaultSourceUrl)
          : await step.run('extract', async () => {
              if (event.data.messages) {
                const msgs = event.data.messages.filter((m) => m.content.trim().length > 0);
                const fullText = msgs.map((m) => m.content).join('\n');
                const chunks = groupMessages(msgs);
                return { fullText, chunks, pageCount: null };
              }

              if (event.data.content) {
                const fullText = event.data.content;
                const chunks = chunkPlainText(fullText, { type: 'TXT' }, defaultSourceUrl);
                return { fullText, chunks, pageCount: null };
              }

              const result = await this.extractContent(storagePath, mimeType);
              const fullText = result.text;
              const chunks = this.chunksFromResult(result, defaultSourceUrl, mimeType);
              const pageCount = result.type === 'pages' ? result.pages.length : null;
              return { fullText, chunks, pageCount };
            });

        await step.run('validate-content', () => {
          if (!extracted.fullText.trim()) {
            throw new Error('No text content extracted from file');
          }
        });

        this.logger.log(
          `Split into ${extracted.chunks.length} chunks${isAppendOnly ? ' (append)' : ''}`
        );

        // Step 3: Cleanup old chunks (for non-append) or get offset (for append)
        const chunkIndexOffset = await step.run('prepare-chunks', async () => {
          if (!isAppendOnly) {
            await this.db.kysely
              .deleteFrom('data.chunks')
              .where('data_source_id', '=', dataSourceId)
              .where('org_id', '=', orgId)
              .execute();
            return 0;
          }

          const maxRow = await this.db.kysely
            .selectFrom('data.chunks')
            .select(this.db.kysely.fn.max('chunk_index').as('max_index'))
            .where('data_source_id', '=', dataSourceId)
            .where('org_id', '=', orgId)
            .executeTakeFirst();
          return maxRow?.max_index != null ? maxRow.max_index + 1 : 0;
        });

        // Step 4: Embed and store chunks. Each batch uses step.ai.wrap for AI
        // observability, then step.run for DB insert + usage logging.
        const totalBatches = Math.ceil(extracted.chunks.length / EMBEDDING_BATCH_SIZE);

        for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
          const batchStart = batchIdx * EMBEDDING_BATCH_SIZE;
          const batch = extracted.chunks.slice(batchStart, batchStart + EMBEDDING_BATCH_SIZE);

          const embedResult = await step.ai.wrap(`embed-batch-${batchIdx}`, async () => {
            const result = await embedMany({
              model: openai.embedding('text-embedding-3-small'),
              values: batch.map((c) => c.content),
            });
            return {
              embeddings: result.embeddings,
              tokens: result.usage.tokens,
            };
          });

          await step.run(`store-batch-${batchIdx}`, async () => {
            const values = batch.map((chunk, idx) => ({
              id: packId('Chunk', orgId),
              content: chunk.content,
              chunk_index: chunkIndexOffset + batchStart + idx,
              metadata: chunk.metadata,
              source_url: chunk.sourceUrl,
              embedding: `[${embedResult.embeddings[idx].join(',')}]`,
              data_source_id: dataSourceId,
              collection_id: collectionId,
              org_id: orgId,
            }));

            await this.db.kysely.insertInto('data.chunks').values(values).execute();

            await this.aiUsageService.logUsage(
              EMBEDDING_MODEL,
              embedResult.tokens,
              0,
              AiCallerType.SYSTEM,
              AiRequestType.EMBEDDING,
              { orgId, source: 'SYSTEM' }
            );
          });
        }

        // Step 5: Finalize
        await step.run('finalize', async () => {
          const totalChunks = isAppendOnly
            ? chunkIndexOffset + extracted.chunks.length
            : extracted.chunks.length;
          await this.db.kysely
            .updateTable('data.data_sources')
            .set({
              status: 'READY',
              page_count: extracted.pageCount ?? totalChunks,
              updated_at: new Date(),
            })
            .where('id', '=', dataSourceId)
            .where('org_id', '=', orgId)
            .execute();
        });

        this.logger.log(`Data source ${dataSourceId} processed successfully`);
      }
    );
  }

  private cleanupDataSource() {
    return inngest.createFunction(
      { id: 'data-source-cleanup', retries: 5 },
      { event: 'app/data-source.cleanup' },
      async ({ event, step }) => {
        const { orgId, dataSourceId, storagePath } = event.data;

        await step.run('delete-chunks', async () => {
          await this.db.kysely
            .deleteFrom('data.chunks')
            .where('data_source_id', '=', dataSourceId)
            .where('org_id', '=', orgId)
            .execute();
        });

        await step.run('delete-s3-file', async () => {
          if (storagePath) {
            await this.storage.delete(storagePath);
          }
        });

        await step.run('delete-record', async () => {
          await this.db.kysely
            .deleteFrom('data.data_sources')
            .where('id', '=', dataSourceId)
            .where('org_id', '=', orgId)
            .execute();
        });
      }
    );
  }

  private maintenanceStaleProcessing() {
    return inngest.createFunction(
      { id: 'maintenance-stale-processing' },
      { cron: '0 * * * *' }, // Every hour
      async ({ step }) => {
        const staleIds = await step.run('find-stale', async () => {
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          // org-safe: system maintenance cron scans all orgs to recover stuck jobs
          const stale = await this.db.kysely
            .selectFrom('data.data_sources')
            .select(['id', 'org_id', 'title'])
            .where('status', '=', 'PROCESSING')
            .where('updated_at', '<', oneHourAgo)
            .execute();
          return stale;
        });

        if (staleIds.length === 0) return;

        await step.run('mark-failed', async () => {
          const ids = staleIds.map((s) => s.id);
          // org-safe: system maintenance cron marks stale jobs failed across all orgs
          await this.db.kysely
            .updateTable('data.data_sources')
            .set({ status: 'FAILED', updated_at: new Date() })
            .where('id', 'in', ids)
            .execute();
        });

        await step.run('notify', async () => {
          const titles = staleIds.map((s) => s.title).join(', ');
          await this.inngestService.send('app/notification.slack', {
            orgId: null,
            type: 'maintenance-alert',
            text: `Recovered ${staleIds.length} stale PROCESSING data sources: ${titles}`,
          });
        });
      }
    );
  }

  /**
   * Extract image content: downloads from storage, runs vision AI, and logs usage.
   * Download + AI happen in one step to avoid serializing the image buffer
   * (5MB image = ~15MB JSON when converted to number array between steps).
   */
  private async extractImage(
    step: InngestStepTools,
    storagePath: string,
    orgId: DbId<'Org'>,
    defaultSourceUrl: string
  ): Promise<{ fullText: string; chunks: ChunkWithMeta[]; pageCount: null }> {
    // Download and analyze in a single step.ai.wrap to get AI observability
    // and avoid serializing the image buffer between steps.
    const aiResult = await step.ai.wrap('analyze-image', async () => {
      const data = await this.storage.get(storagePath);

      const result = await generateText({
        model: openai('gpt-4o-mini'),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this image and provide:
1. A detailed description of the image content (2-4 sentences).
2. A list of relevant tags (comma-separated, 3-8 tags).
3. Any visible text in the image (OCR). If no text is visible, write "None".

Format your response EXACTLY as:
DESCRIPTION: <your description>
TAGS: <tag1, tag2, tag3>
TEXT: <visible text or None>`,
              },
              { type: 'image', image: new Uint8Array(data) },
            ],
          },
        ],
      });

      return {
        text: result.text,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      };
    });

    await step.run('log-image-usage', async () => {
      await this.aiUsageService.logUsage(
        'openai/gpt-4o-mini',
        aiResult.inputTokens ?? 0,
        aiResult.outputTokens ?? 0,
        AiCallerType.SYSTEM,
        AiRequestType.CHAT,
        { orgId, source: 'SYSTEM' }
      );
    });

    const result = aiResult.text;

    const chunks = chunkPlainText(result, { type: 'IMAGE' }, defaultSourceUrl);
    return { fullText: result, chunks, pageCount: null };
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
        // Images are handled by extractImage(), not this path
        const meta: ChunkMeta = dsType === 'JSON' ? { type: 'JSON' } : { type: 'TXT' };
        return chunkPlainText(result.text, meta, sourceUrl);
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
        // Images are handled via extractImage(), not this path
        throw new Error('Image extraction should use extractImage()');
      default: {
        const _exhaustive: never = mimeType;
        throw new Error(`Unsupported mime type: ${_exhaustive}`);
      }
    }
  }
}
