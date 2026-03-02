import { Logger } from '@nestjs/common';

import { dbIdSchema } from '@grabdy/common';
import type { ChatSource, StreamChunk } from '@grabdy/contracts';
import { dataSourceTypeEnum } from '@grabdy/contracts';
import type { TextStreamPart, ToolSet } from 'ai';
import { z } from 'zod';

import type { PreviousToolCall, Tool } from './base-tool';

function accumulateChunk(
  chunk: StreamChunk,
  fullText: { value: string },
  thinkingTexts: string[],
  sources: ChatSource[]
): void {
  if (chunk.type === 'text') {
    fullText.value += chunk.text;
  } else if (chunk.type === 'thinking') {
    thinkingTexts.push(chunk.text);
  } else if (chunk.type === 'sources') {
    sources.push(...chunk.sources);
  }
}

interface AgentStreamResult {
  chunks: AsyncIterable<StreamChunk>;
  getFullText: () => string;
  getThinkingTexts: () => string[];
  getSources: () => ChatSource[];
  getLastFinishReason: () => string;
}

const logger = new Logger('AgentStream');

/**
 * Regex that matches XML-style tags some models emit in text output
 * (e.g. <function_calls>, <invoke>, <parameter>).
 */
const XML_TAG_RE = /<\/?(?:function_calls|invoke|parameter|antml:\w+)[^>]*>/g;

function stripXmlTags(text: string): string | null {
  const cleaned = text.replace(XML_TAG_RE, '');
  return cleaned.length > 0 ? cleaned : null;
}

// ---------------------------------------------------------------------------
// Inline sources extraction
// ---------------------------------------------------------------------------

const SOURCES_BLOCK_RE = /```sources\s*\n([\s\S]*?)```\s*$/;
const TRAILING_SOURCES_RE = /\n*(?:Sources?(?:\s+used)?:|References?:)\s*\n[\s\S]*$/i;

/** Derived from contracts so new DataSourceType values are automatically accepted. */
const VALID_TYPES: ReadonlySet<string> = new Set(dataSourceTypeEnum.options);

const rawInlineSourceSchema = z.object({
  ref: z.number().optional(),
  dataSourceId: z.string().optional(),
  dataSourceName: z.string().optional(),
  type: z.string().optional(),
  sourceUrl: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  score: z.number().optional(),
  content: z.string().optional(),
  pages: z.array(z.number()).optional(),
  sheet: z.string().optional(),
  rows: z.array(z.number()).optional(),
  columns: z.array(z.string()).optional(),
});

type RawInlineSource = z.infer<typeof rawInlineSourceSchema>;

function buildChatSource(raw: RawInlineSource): ChatSource | null {
  const idParsed = dbIdSchema('DataSource').safeParse(raw.dataSourceId);
  if (!idParsed.success || !raw.dataSourceName) return null;

  const type = raw.type ?? 'TXT';
  if (!VALID_TYPES.has(type)) return null;

  const base = {
    ref: raw.ref,
    dataSourceId: idParsed.data,
    dataSourceName: raw.dataSourceName,
    score: typeof raw.score === 'number' ? raw.score : 0,
    sourceUrl: raw.sourceUrl ?? null,
    imageUrl: raw.imageUrl ?? null,
    content: raw.content,
  };

  switch (type) {
    case 'PDF':
      return { ...base, type: 'PDF', pages: raw.pages ?? [] };
    case 'DOCX':
      return { ...base, type: 'DOCX', pages: raw.pages ?? [] };
    case 'XLSX':
      return {
        ...base,
        type: 'XLSX',
        sheet: raw.sheet ?? '',
        rows: raw.rows ?? [],
        columns: raw.columns ?? [],
      };
    case 'CSV':
      return { ...base, type: 'CSV', rows: raw.rows ?? [], columns: raw.columns ?? [] };
    case 'TXT':
      return { ...base, type: 'TXT' };
    case 'JSON':
      return { ...base, type: 'JSON' };
    case 'IMAGE':
      return { ...base, type: 'IMAGE' };
    case 'EMAIL':
      return { ...base, type: 'EMAIL' };
    case 'SLACK':
      return { ...base, type: 'SLACK' };
    case 'LINEAR':
      return { ...base, type: 'LINEAR' };
    case 'GITHUB':
      return { ...base, type: 'GITHUB' };
    case 'NOTION':
      return { ...base, type: 'NOTION' };
    default:
      return null;
  }
}

/**
 * Extract inline sources from the AI's text output.
 * Looks for a fenced ```sources block containing a JSON array.
 * Also strips trailing "Sources:" text as a safety net.
 */
function extractInlineSources(text: string): { cleanText: string; sources: ChatSource[] } {
  const match = text.match(SOURCES_BLOCK_RE);
  if (!match) {
    // Strip trailing plain-text source references as safety net
    const cleanText = text.replace(TRAILING_SOURCES_RE, '').trimEnd();
    return { cleanText, sources: [] };
  }

  let cleanText = text.slice(0, match.index).trimEnd();
  // Also strip trailing plain-text sources above the code block
  cleanText = cleanText.replace(TRAILING_SOURCES_RE, '').trimEnd();

  const jsonStr = match[1].trim();
  const sources: ChatSource[] = [];

  try {
    const parsed = z.array(rawInlineSourceSchema).safeParse(JSON.parse(jsonStr));
    if (parsed.success) {
      for (const raw of parsed.data) {
        const source = buildChatSource(raw);
        if (source) {
          sources.push(source);
        }
      }
    } else {
      logger.warn(`Inline sources validation failed: ${parsed.error.message}`);
    }
  } catch {
    logger.warn('Failed to parse inline sources JSON');
  }

  return { cleanText, sources };
}

// ---------------------------------------------------------------------------
// Stream processor
// ---------------------------------------------------------------------------

/**
 * Process a raw AI SDK fullStream into typed chunks.
 * Text deltas become { type: 'text' }, tool hooks emit thinking/sources chunks.
 * After streaming, extracts inline sources from the text.
 */
export function processStream(
  fullStream: AsyncIterable<TextStreamPart<ToolSet>>,
  hooks: Record<string, Tool>,
  logPrefix = '[stream]'
): AgentStreamResult {
  const fullText = { value: '' };
  const thinkingTexts: string[] = [];
  const sources: ChatSource[] = [];
  const streamStart = Date.now();
  let textChunks = 0;
  let rawTextDeltas = 0;
  let stepCount = 0;
  let lastFinishReason = '';
  const previousCalls: PreviousToolCall[] = [];
  let inlineSourcesExtracted = false;

  async function* generate(): AsyncIterable<StreamChunk> {
    for await (const part of fullStream) {
      const elapsed = Date.now() - streamStart;

      if (part.type === 'text-delta') {
        rawTextDeltas++;
        const cleaned = stripXmlTags(part.text);
        if (!cleaned) {
          if (part.text.length > 0) {
            logger.warn(
              `${logPrefix} Stripped XML from text-delta at +${elapsed}ms: ${part.text.slice(0, 200)}`
            );
          }
          continue;
        }
        if (textChunks === 0) {
          logger.log(`${logPrefix} First text chunk at +${elapsed}ms`);
        }
        textChunks++;
        fullText.value += cleaned;
        yield { type: 'text', text: cleaned };
      } else if (part.type === 'tool-call') {
        const hook = hooks[part.toolName];
        if (hook?.onToolCall) {
          const chunk = hook.onToolCall({
            toolCallKey: part.toolCallId,
            input: part.input,
            previousCalls: [...previousCalls],
          });
          if (chunk) {
            accumulateChunk(chunk, fullText, thinkingTexts, sources);
            yield chunk;
          }
        }
        previousCalls.push({ toolName: part.toolName, toolCallKey: part.toolCallId });
        logger.log(
          `${logPrefix} Tool call: ${part.toolName} at +${elapsed}ms args=${JSON.stringify(part.input).slice(0, 1000)}`
        );
      } else if (part.type === 'tool-result') {
        const hook = hooks[part.toolName];
        if (hook?.onToolResult) {
          const chunk = hook.onToolResult({
            toolCallKey: part.toolCallId,
            input: part.input,
            output: part.output,
            previousCalls: [...previousCalls],
          });
          if (chunk) {
            accumulateChunk(chunk, fullText, thinkingTexts, sources);
            yield chunk;
          }
        }
        const resultStr = JSON.stringify(part.output).slice(0, 500);
        logger.log(`${logPrefix} Tool result: ${part.toolName} OK at +${elapsed}ms → ${resultStr}`);
      } else if (part.type === 'tool-error') {
        logger.error(
          `${logPrefix} Tool ERROR: ${part.toolName} at +${elapsed}ms error=${part.error instanceof Error ? part.error.message : JSON.stringify(part.error)} args=${JSON.stringify(part.input).slice(0, 500)}`
        );
      } else if (part.type === 'error') {
        logger.error(
          `${logPrefix} Stream ERROR at +${elapsed}ms: ${part.error instanceof Error ? part.error.message : JSON.stringify(part.error)}`
        );
      } else if (part.type === 'finish-step') {
        stepCount++;
        lastFinishReason = String(
          (part satisfies { type: 'finish-step' }).finishReason ?? 'unknown'
        );
        logger.log(
          `${logPrefix} Step ${stepCount} finished at +${elapsed}ms reason=${lastFinishReason} (${textChunks} text chunks)`
        );
      }
    }

    // Extract inline sources from accumulated text
    const { cleanText, sources: inlineSources } = extractInlineSources(fullText.value);
    if (inlineSources.length > 0) {
      fullText.value = cleanText;
      sources.push(...inlineSources);
      inlineSourcesExtracted = true;
      yield { type: 'sources', sources: inlineSources };
    } else if (fullText.value !== cleanText) {
      // Text was cleaned (trailing Sources: removed) but no structured sources found
      fullText.value = cleanText;
    }

    const elapsed = Date.now() - streamStart;
    if (textChunks === 0) {
      logger.warn(
        `${logPrefix} Stream produced NO text at +${elapsed}ms after ${stepCount} steps, lastFinishReason=${lastFinishReason}, rawTextDeltas=${rawTextDeltas}`
      );
    } else {
      logger.log(
        `${logPrefix} Complete at +${elapsed}ms, ${textChunks} text chunks total${inlineSourcesExtracted ? `, ${sources.length} inline sources` : ''}`
      );
    }
  }

  return {
    chunks: generate(),
    getFullText: () => fullText.value,
    getThinkingTexts: () => thinkingTexts,
    getSources: () => sources,
    getLastFinishReason: () => lastFinishReason,
  };
}
