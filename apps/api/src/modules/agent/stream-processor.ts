import { Logger } from '@nestjs/common';

import type { ChatSource, StreamChunk } from '@grabdy/contracts';
import type { TextStreamPart, ToolSet } from 'ai';

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

export interface AgentStreamResult {
  chunks: AsyncIterable<StreamChunk>;
  getFullText: () => string;
  getThinkingTexts: () => string[];
  getSources: () => ChatSource[];
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

/**
 * Process a raw AI SDK fullStream into typed chunks.
 * Text deltas become { type: 'text' }, tool hooks emit thinking/sources chunks.
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
  let stepCount = 0;
  const previousCalls: PreviousToolCall[] = [];

  async function* generate(): AsyncIterable<StreamChunk> {
    for await (const part of fullStream) {
      const elapsed = Date.now() - streamStart;

      if (part.type === 'text-delta') {
        const cleaned = stripXmlTags(part.text);
        if (!cleaned) continue;
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
        logger.log(
          `${logPrefix} Step ${stepCount} finished at +${elapsed}ms (${textChunks} text chunks)`
        );
      }
    }

    logger.log(
      `${logPrefix} Complete at +${Date.now() - streamStart}ms, ${textChunks} text chunks total`
    );
  }

  return {
    chunks: generate(),
    getFullText: () => fullText.value,
    getThinkingTexts: () => thinkingTexts,
    getSources: () => sources,
  };
}
