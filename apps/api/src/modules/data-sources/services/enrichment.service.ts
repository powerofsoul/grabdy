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

import { AiService } from '../../ai/ai.service';
import {
  CHAT_VISION_LANGUAGE_MODEL,
  ENRICHMENT_LANGUAGE_MODEL,
  IMAGE_VISION_LANGUAGE_MODEL,
} from '../../ai/bedrock.provider';
import type { ChunkWithMeta } from '../data-source.types';

const MAX_IMAGES_PER_DOCUMENT = 20;
const MAX_DOCUMENT_SUMMARY_CHARS = 2000;
const IMAGE_BATCH_SIZE = 5;
const IMAGE_BATCH_CONCURRENCY = 2;
const CONTEXT_CONCURRENCY = 25;
const MAX_IMAGE_ASPECT_RATIO = 20;

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

  constructor(private aiService: AiService) {}

  async describeImages(params: {
    orgId: DbId<'Org'>;
    images: Array<{
      buffer: Buffer;
      page?: number;
      width?: number;
      height?: number;
      surroundingText?: string;
    }>;
  }): Promise<Array<{ page?: number; description: string }>> {
    const orgId = dbIdSchema('Org').parse(params.orgId);
    const images = params.images.slice(0, MAX_IMAGES_PER_DOCUMENT);

    if (images.length === 0) return [];

    // Split images by aspect ratio: Nova Lite rejects images > 20:1
    const novaImages: typeof images = [];
    const fallbackImages: typeof images = [];

    for (const image of images) {
      const w = image.width ?? 1;
      const h = image.height ?? 1;
      const ratio = Math.max(w, h) / Math.min(w, h);
      if (ratio > MAX_IMAGE_ASPECT_RATIO) {
        fallbackImages.push(image);
      } else {
        novaImages.push(image);
      }
    }

    // Process normal images in batches via Nova Lite
    const novaResults = await this.describeImageBatchesNovaLite(orgId, novaImages);

    // Process extreme aspect ratio images individually via Haiku (no ratio limit)
    const fallbackResults = await pMap(
      fallbackImages,
      async (image) => {
        const contextLine = image.surroundingText
          ? `Surrounding text: ${image.surroundingText}`
          : '';
        const prompt = ['Describe this image in the context of the document.', contextLine]
          .filter(Boolean)
          .join(' ');
        const pageLabel = image.page !== undefined ? ` (page ${image.page})` : '';

        const aiResult = await this.aiService.generateText(
          {
            model: CHAT_VISION_LANGUAGE_MODEL,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'image', image: new Uint8Array(image.buffer) },
                ],
              },
            ],
          },
          CHAT_MODEL_VISION,
          AiRequestType.IMAGE_ANALYSIS,
          { orgId, source: 'SYSTEM', description: `Describe PDF image${pageLabel} (fallback)` }
        );

        return { page: image.page, description: aiResult.text };
      },
      { concurrency: IMAGE_BATCH_CONCURRENCY }
    );

    // Reassemble results in original order
    const resultMap = new Map<number, { page?: number; description: string }>();
    for (const r of [...novaResults, ...fallbackResults]) {
      // Use page as key (images are unique per page in a range)
      if (r.page !== undefined) {
        resultMap.set(r.page, r);
      }
    }

    return images.map((img) => {
      if (img.page !== undefined) {
        return resultMap.get(img.page) ?? { page: img.page, description: '' };
      }
      // No page info: nova results come first, then fallback
      const novaIdx = novaImages.indexOf(img);
      if (novaIdx >= 0) return novaResults[novaIdx];
      const fbIdx = fallbackImages.indexOf(img);
      if (fbIdx >= 0) return fallbackResults[fbIdx];
      return { page: undefined, description: '' };
    });
  }

  private async describeImageBatchesNovaLite(
    orgId: DbId<'Org'>,
    images: Array<{
      buffer: Buffer;
      page?: number;
      width?: number;
      height?: number;
      surroundingText?: string;
    }>
  ): Promise<Array<{ page?: number; description: string }>> {
    if (images.length === 0) return [];

    const batches: Array<typeof images> = [];
    for (let i = 0; i < images.length; i += IMAGE_BATCH_SIZE) {
      batches.push(images.slice(i, i + IMAGE_BATCH_SIZE));
    }

    const SEPARATOR = '---IMG---';

    const batchResults = await pMap(
      batches,
      async (batch) => {
        const imageContent: Array<
          { type: 'text'; text: string } | { type: 'image'; image: Uint8Array }
        > = [];

        const promptLines = [
          `Describe each of the following ${batch.length} image(s) in the context of the document.`,
          `Return exactly ${batch.length} description(s), one per image in order.`,
        ];
        if (batch.length > 1) {
          promptLines.push(`Separate each description with "${SEPARATOR}" on its own line.`);
        }

        imageContent.push({ type: 'text', text: promptLines.join(' ') });

        for (const image of batch) {
          if (image.surroundingText) {
            imageContent.push({ type: 'text', text: `Surrounding text: ${image.surroundingText}` });
          }
          imageContent.push({ type: 'image', image: new Uint8Array(image.buffer) });
        }

        const pageLabel =
          batch[0].page !== undefined ? ` (pages ${batch.map((b) => b.page).join(',')})` : '';

        const aiResult = await this.aiService.generateText(
          {
            model: IMAGE_VISION_LANGUAGE_MODEL,
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

        const descriptions =
          batch.length === 1
            ? [aiResult.text.trim()]
            : aiResult.text
                .split(SEPARATOR)
                .map((d) => d.trim())
                .filter(Boolean);

        return batch.map((image, idx) => ({
          page: image.page,
          description: descriptions[idx] ?? '',
        }));
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
    chunks: Array<{ content: string; pageNumber: number }>;
    documentSummary: string;
    filename: string;
    sourceType?: ChunkMeta['type'];
  }): Promise<Array<{ context: string; questions: string[] }>> {
    const orgId = dbIdSchema('Org').parse(params.orgId);
    const chunks = params.chunks;
    const docSummary = params.documentSummary.slice(0, MAX_DOCUMENT_SUMMARY_CHARS);
    const questionGuidance = sourceTypeQuestionGuidance(params.sourceType);
    const contexts = await pMap(
      chunks,
      async (chunk, idx) => {
        try {
          const prompt = [
            '<source>',
            `Title: ${params.filename}`,
            docSummary,
            '</source>',
            '<chunk>',
            chunk.content.slice(0, 1500),
            '</chunk>',
            'Given this source and chunk:',
            '1. Write a short context (1-2 sentences) that situates this chunk, mentioning specific entities, topics, or details.',
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
    case 'SLACK':
      lines.push(`Channel: ${title}`);
      if (meta.slackAuthors.length > 0) lines.push(`Authors: ${meta.slackAuthors.join(', ')}`);
      break;
    case 'NOTION':
      lines.push(`Page: ${title}`);
      break;
    case 'GITHUB':
      lines.push(`${meta.githubItemType}: ${title}`);
      break;
    case 'LINEAR':
      lines.push(`Issue: ${title}`);
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
    case 'SLACK':
      return 'Focus on who said what and the topic discussed, e.g. "what did [person] say about [topic]?"';
    case 'CSV':
    case 'XLSX':
      return 'Reference column names as dimensions, e.g. "what is the [column] for [entity]?" or "which [entity] has the highest [column]?"';
    case 'EMAIL':
      return 'Reference sender, recipients, or subject, e.g. "email from [person] about [topic]"';
    case 'LINEAR':
      return 'Reference the issue topic, status, or assignee, e.g. "what is the status of [feature]?" or "issues assigned to [person]"';
    case 'GITHUB':
      return 'Reference the issue/PR topic, labels, or author, e.g. "PRs related to [topic]" or "bugs labeled [label]"';
    case 'NOTION':
      return 'Reference the page topic or content, e.g. "how does [process] work?" or "what is the policy on [topic]?"';
    default:
      return 'Be specific, not generic.';
  }
}
