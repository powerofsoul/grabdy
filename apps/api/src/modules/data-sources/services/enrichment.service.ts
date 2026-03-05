import { Injectable, Logger } from '@nestjs/common';

import { type DbId, dbIdSchema } from '@grabdy/common';
import type { ChunkMeta } from '@grabdy/contracts';
import {
  AiRequestType,
  CHAT_MODEL_VISION,
  ENRICHMENT_MODEL,
  IMAGE_VISION_MODEL,
} from '@grabdy/contracts';
import pMap from 'p-map';
import { z } from 'zod';

import { AiService } from '../../ai/ai.service';
import {
  CHAT_VISION_LANGUAGE_MODEL,
  ENRICHMENT_LANGUAGE_MODEL,
  IMAGE_VISION_LANGUAGE_MODEL,
} from '../../ai/bedrock.provider';
import { NotificationService } from '../../notification/notification.service';
import type { ChunkWithMeta } from '../data-source.types';

const MAX_IMAGES_PER_DOCUMENT = 20;
const MAX_DOCUMENT_SUMMARY_CHARS = 2000;
const IMAGE_BATCH_SIZE = 5;
const IMAGE_BATCH_CONCURRENCY = 2;
const CONTEXT_CONCURRENCY = 25;
const MAX_IMAGE_ASPECT_RATIO = 20;

const IMAGE_TYPE_VALUES = [
  'photo',
  'chart',
  'diagram',
  'table',
  'screenshot',
  'illustration',
  'logo',
  'map',
  'formula',
  'other',
] as const;

export const imageAnalysisSchema = z.object({
  type: z.enum(IMAGE_TYPE_VALUES).describe('The type of image'),
  description: z.string().describe('2-4 sentence description of content and purpose'),
  visibleText: z
    .string()
    .describe('All readable text: labels, axes, legends, titles, captions. Empty string if none'),
  dataValues: z
    .string()
    .describe('Key numeric values, measurements, data points. Empty string if none'),
  relationships: z
    .string()
    .describe(
      'How elements relate, e.g. "Revenue grew Q1-Q3", "A depends on B". Empty string if n/a'
    ),
});

export type ImageAnalysis = z.infer<typeof imageAnalysisSchema>;

const batchImageAnalysisSchema = z.object({
  images: z.array(imageAnalysisSchema),
});

export const VISION_SYSTEM_PROMPT =
  'Analyze images from a document. Describe content, extract all visible text, note data values and relationships between elements.';

const EMPTY_IMAGE_ANALYSIS: ImageAnalysis = {
  type: 'other',
  description: '',
  visibleText: '',
  dataValues: '',
  relationships: '',
};

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

  constructor(
    private aiService: AiService,
    private notification: NotificationService
  ) {}

  async describeImages(params: {
    orgId: DbId<'Org'>;
    dataSourceId: DbId<'DataSource'>;
    storagePath: string;
    images: Array<{
      buffer: Buffer;
      page?: number;
      width?: number;
      height?: number;
      surroundingText?: string;
    }>;
  }): Promise<Array<{ page?: number; analysis: ImageAnalysis }>> {
    const orgId = dbIdSchema('Org').parse(params.orgId);
    const images = params.images.slice(0, MAX_IMAGES_PER_DOCUMENT);

    if (images.length === 0) return [];

    // Split images by aspect ratio: Nova Lite rejects images > 20:1
    // Track which group each image belongs to for reassembly
    const novaImages: typeof images = [];
    const fallbackImages: typeof images = [];
    const isFallback: boolean[] = [];

    for (const image of images) {
      const w = image.width ?? 1;
      const h = image.height ?? 1;
      const ratio = Math.max(w, h) / Math.min(w, h);
      if (ratio > MAX_IMAGE_ASPECT_RATIO) {
        fallbackImages.push(image);
        isFallback.push(true);
      } else {
        novaImages.push(image);
        isFallback.push(false);
      }
    }

    // Process normal images in batches via Nova Lite
    const novaResults = await this.describeImageBatchesNovaLite(
      orgId,
      params.dataSourceId,
      params.storagePath,
      novaImages
    );

    // Process extreme aspect ratio images individually via Haiku (no ratio limit)

    const fallbackResults = await pMap(
      fallbackImages,
      async (image) => {
        try {
          const contextLine = image.surroundingText
            ? `Surrounding text: ${image.surroundingText}`
            : '';
          const pageLabel = image.page !== undefined ? ` (page ${image.page})` : '';

          const aiResult = await this.aiService.generateStructuredObject(
            imageAnalysisSchema,
            {
              model: CHAT_VISION_LANGUAGE_MODEL,
              system: VISION_SYSTEM_PROMPT,
              messages: [
                {
                  role: 'user',
                  content: [
                    ...(contextLine ? [{ type: 'text' as const, text: contextLine }] : []),
                    { type: 'image', image: new Uint8Array(image.buffer) },
                  ],
                },
              ],
            },
            CHAT_MODEL_VISION,
            AiRequestType.IMAGE_ANALYSIS,
            { orgId, source: 'SYSTEM', description: `Describe PDF image${pageLabel} (fallback)` }
          );

          return { page: image.page, analysis: aiResult };
        } catch (err) {
          this.logger.warn(
            `Fallback image description failed (page ${image.page}), skipping: ${String(err)}`
          );
          this.notification.notifyImageDescriptionFailure(
            params.dataSourceId,
            params.storagePath,
            image.page !== undefined ? [image.page] : [],
            String(err)
          );
          return { page: image.page, analysis: EMPTY_IMAGE_ANALYSIS };
        }
      },
      { concurrency: IMAGE_BATCH_CONCURRENCY }
    );

    // Reassemble results in original order using tracked group indices
    let novaIdx = 0;
    let fbIdx = 0;
    return images.map((img, i) => {
      if (isFallback[i]) {
        return fallbackResults[fbIdx++] ?? { page: img.page, analysis: EMPTY_IMAGE_ANALYSIS };
      }
      return novaResults[novaIdx++] ?? { page: img.page, analysis: EMPTY_IMAGE_ANALYSIS };
    });
  }

  private async describeImageBatchesNovaLite(
    orgId: DbId<'Org'>,
    dataSourceId: DbId<'DataSource'>,
    storagePath: string,
    images: Array<{
      buffer: Buffer;
      page?: number;
      width?: number;
      height?: number;
      surroundingText?: string;
    }>
  ): Promise<Array<{ page?: number; analysis: ImageAnalysis }>> {
    if (images.length === 0) return [];

    const batches: Array<typeof images> = [];
    for (let i = 0; i < images.length; i += IMAGE_BATCH_SIZE) {
      batches.push(images.slice(i, i + IMAGE_BATCH_SIZE));
    }

    const batchResults = await pMap(
      batches,
      async (batch) => {
        try {
          const imageContent: Array<
            { type: 'text'; text: string } | { type: 'image'; image: Uint8Array }
          > = [];

          for (const image of batch) {
            if (image.surroundingText) {
              imageContent.push({
                type: 'text',
                text: `Surrounding text: ${image.surroundingText}`,
              });
            }
            imageContent.push({ type: 'image', image: new Uint8Array(image.buffer) });
          }

          const pageLabel =
            batch[0].page !== undefined ? ` (pages ${batch.map((b) => b.page).join(',')})` : '';

          const aiResult = await this.aiService.generateStructuredObject(
            batchImageAnalysisSchema,
            {
              model: IMAGE_VISION_LANGUAGE_MODEL,
              system:
                VISION_SYSTEM_PROMPT +
                ` Return exactly ${batch.length} image analysis result(s) in the images array, one per image in order.`,
              messages: [{ role: 'user', content: imageContent }],
            },
            IMAGE_VISION_MODEL,
            AiRequestType.IMAGE_ANALYSIS,
            {
              orgId,
              source: 'SYSTEM',
              description: `Describe ${batch.length} PDF image(s)${pageLabel}`,
            }
          );

          const { images: analyses } = aiResult;
          return batch.map((image, idx) => ({
            page: image.page,
            analysis: analyses[idx] ?? EMPTY_IMAGE_ANALYSIS,
          }));
        } catch (batchErr) {
          // Batch failed, retry each image individually
          this.logger.warn(
            `Image description batch failed (${batch.length} images), retrying individually: ${String(batchErr)}`
          );
          return pMap(
            batch,
            async (image) => {
              try {
                const contextLine = image.surroundingText
                  ? `Surrounding text: ${image.surroundingText}`
                  : '';
                const pageLabel = image.page !== undefined ? ` (page ${image.page})` : '';

                const aiResult = await this.aiService.generateStructuredObject(
                  imageAnalysisSchema,
                  {
                    model: IMAGE_VISION_LANGUAGE_MODEL,
                    system: VISION_SYSTEM_PROMPT,
                    messages: [
                      {
                        role: 'user',
                        content: [
                          ...(contextLine ? [{ type: 'text' as const, text: contextLine }] : []),
                          { type: 'image', image: new Uint8Array(image.buffer) },
                        ],
                      },
                    ],
                  },
                  IMAGE_VISION_MODEL,
                  AiRequestType.IMAGE_ANALYSIS,
                  {
                    orgId,
                    source: 'SYSTEM',
                    description: `Describe PDF image${pageLabel} (individual retry)`,
                  }
                );

                return { page: image.page, analysis: aiResult };
              } catch (imgErr) {
                this.logger.warn(
                  `Individual image description failed (page ${image.page}): ${String(imgErr)}`
                );
                this.notification.notifyImageDescriptionFailure(
                  dataSourceId,
                  storagePath,
                  image.page !== undefined ? [image.page] : [],
                  String(imgErr)
                );
                return { page: image.page, analysis: EMPTY_IMAGE_ANALYSIS };
              }
            },
            { concurrency: 1 }
          );
        }
      },
      { concurrency: IMAGE_BATCH_CONCURRENCY }
    );

    return batchResults.flat();
  }

  /**
   * Generate contextual descriptions for chunks using Anthropic's Contextual Retrieval technique.
   * Each chunk gets a short description situating it within the overall document,
   * improving search retrieval by ~49%.
   */

  async generateChunkContexts(params: {
    orgId: DbId<'Org'>;
    chunks: Array<{ content: string; pageNumber: number; chunkType?: ChunkMeta['type'] }>;
    documentSummary: string;
    filename: string;
    sourceType?: ChunkMeta['type'];
    onProgress?: (completed: number, total: number) => void;
  }): Promise<Array<{ context: string; questions: string[] }>> {
    const orgId = dbIdSchema('Org').parse(params.orgId);
    const chunks = params.chunks;
    const docSummary = params.documentSummary.slice(0, MAX_DOCUMENT_SUMMARY_CHARS);
    const defaultGuidance = sourceTypeQuestionGuidance(params.sourceType);
    let completedCount = 0;
    const contexts = await pMap(
      chunks,
      async (chunk, idx) => {
        try {
          const isImage = chunk.chunkType === 'IMAGE';
          const questionGuidance = isImage ? sourceTypeQuestionGuidance('IMAGE') : defaultGuidance;
          const contextInstruction = isImage
            ? '1. Write a short context (1-2 sentences) describing what this image shows and its role in the document.'
            : '1. Write a short context (1-2 sentences) that situates this chunk, mentioning specific entities, topics, or details.';
          const prompt = [
            '<source>',
            `Title: ${params.filename}`,
            docSummary,
            '</source>',
            `<chunk${isImage ? ' type="image"' : ''}>`,
            chunk.content.slice(0, 1500),
            '</chunk>',
            'Given this source and chunk:',
            contextInstruction,
            `2. Write two questions a user would naturally type into a search box to find this information. ${questionGuidance}`,
            '',
            'Context: ...',
            'Q1: ...',
            'Q2: ...',
          ].join('\n');

          const aiResult = await this.aiService.generateText(
            {
              model: ENRICHMENT_LANGUAGE_MODEL,
              messages: [{ role: 'user', content: prompt }],
              maxOutputTokens: 200,
            },
            ENRICHMENT_MODEL,
            AiRequestType.ENRICHMENT,
            { orgId, source: 'SYSTEM', description: 'Contextual retrieval for chunk' }
          );

          return parseChunkContext(aiResult.text);
        } catch (err) {
          this.logger.warn(`Failed to generate context for chunk ${idx}: ${String(err)}`);
          return { context: '', questions: [] };
        } finally {
          completedCount++;
          params.onProgress?.(completedCount, chunks.length);
        }
      },
      { concurrency: CONTEXT_CONCURRENCY }
    );

    return contexts;
  }

  /**
   * Enrich chunks with metadata headers, AI context, and hypothetical questions.
   * Works for all source types (files, integrations).
   */
  async enrichChunks(params: {
    orgId: DbId<'Org'>;
    chunks: ChunkWithMeta[];
    title: string;
  }): Promise<ChunkWithMeta[]> {
    const { chunks, title } = params;
    if (chunks.length === 0) return chunks;

    const docSummary = chunks
      .slice(0, 5)
      .map((c) => c.content)
      .join('\n')
      .slice(0, 2000);

    const chunkData = chunks.map((c) => ({
      content: c.content,
      pageNumber: getPageFromMeta(c.metadata),
      chunkType: c.metadata.type,
    }));

    const sourceType = chunks[0].metadata.type;
    const contexts = await this.generateChunkContexts({
      orgId: params.orgId,
      chunks: chunkData,
      documentSummary: docSummary,
      filename: title,
      sourceType,
    });

    return chunks.map((chunk, i) => {
      const lines = buildMetadataHeader(chunk.metadata, title);

      const ctx = contexts[i];
      if (ctx && ctx.context) {
        lines.push(`Context: ${ctx.context}`);
      }
      if (ctx && ctx.questions.length > 0) {
        lines.push(`Questions: ${ctx.questions.join(' | ')}`);
      }

      lines.push('---');
      return { ...chunk, embeddingContext: lines.join('\n') + '\n' };
    });
  }

  async interpretTables(params: {
    orgId: DbId<'Org'>;
    tables: Array<{ content: string; sheetName?: string }>;
  }): Promise<Array<{ interpretation: string }>> {
    const orgId = dbIdSchema('Org').parse(params.orgId);

    const results: Array<{ interpretation: string }> = [];

    for (const table of params.tables) {
      const prompt = `Summarize this table data in natural language:\n\n${table.content}`;

      const aiResult = await this.aiService.generateText(
        {
          model: ENRICHMENT_LANGUAGE_MODEL,
          messages: [{ role: 'user', content: prompt }],
        },
        ENRICHMENT_MODEL,
        AiRequestType.ENRICHMENT,
        { orgId, source: 'SYSTEM', description: 'Table interpretation' }
      );

      results.push({ interpretation: aiResult.text });
    }

    return results;
  }
}

function parseChunkContext(text: string): { context: string; questions: string[] } {
  // Case-insensitive, multi-line: capture everything between Context: and Q1:
  const contextMatch = text.match(/^context:\s*(.+?)(?=\nq1:)/ims);
  const q1Match = text.match(/^q1:\s*(.+)/im);
  const q2Match = text.match(/^q2:\s*(.+)/im);

  const context = contextMatch ? contextMatch[1].trim() : '';
  const questions: string[] = [];
  if (q1Match) questions.push(q1Match[1].trim());
  if (q2Match) questions.push(q2Match[1].trim());

  // Fallback: if the model didn't follow the format, use the whole text as context
  if (!context && questions.length === 0) {
    return { context: text.trim(), questions: [] };
  }

  return { context, questions };
}

function getPageFromMeta(meta: ChunkMeta): number {
  if (meta.type === 'PDF' || meta.type === 'DOCX') {
    return meta.pages[0] ?? 1;
  }
  if (meta.type === 'XLSX' || meta.type === 'CSV') {
    return meta.row;
  }
  return 1;
}

function buildMetadataHeader(meta: ChunkMeta, title: string): string[] {
  const lines: string[] = [];

  switch (meta.type) {
    case 'PDF':
    case 'DOCX': {
      if (title) lines.push(`Document: ${title}`);
      const page = meta.pages[0];
      if (page !== undefined) lines.push(`Page: ${page}`);
      break;
    }
    case 'XLSX':
      if (title) lines.push(`Document: ${title}`);
      lines.push(`Sheet: ${meta.sheet}`);
      if (meta.columns.length > 0) lines.push(`Columns: ${meta.columns.join(', ')}`);
      lines.push(`Row: ${meta.row}`);
      break;
    case 'CSV':
      if (title) lines.push(`Document: ${title}`);
      if (meta.columns.length > 0) lines.push(`Columns: ${meta.columns.join(', ')}`);
      lines.push(`Row: ${meta.row}`);
      break;
    case 'EMAIL':
      lines.push(`Email: ${meta.emailSubject}`);
      lines.push(`From: ${meta.emailFrom}`);
      if (meta.emailTo.length > 0) lines.push(`To: ${meta.emailTo.join(', ')}`);
      lines.push(`Date: ${meta.emailDate}`);
      break;
    case 'TXT':
    case 'JSON':
    case 'IMAGE':
      if (title) lines.push(`Document: ${title}`);
      break;
  }

  return lines;
}

function sourceTypeQuestionGuidance(sourceType?: ChunkMeta['type']): string {
  switch (sourceType) {
    case 'IMAGE':
      return 'Focus on what the image shows, data values, diagram content, or visual elements, e.g. "chart showing [metric]" or "diagram of [process]"';
    case 'CSV':
    case 'XLSX':
      return 'Reference column names as dimensions, e.g. "what is the [column] for [entity]?" or "which [entity] has the highest [column]?"';
    case 'EMAIL':
      return 'Reference sender, recipients, or subject, e.g. "email from [person] about [topic]"';
    default:
      return 'Be specific, not generic.';
  }
}
