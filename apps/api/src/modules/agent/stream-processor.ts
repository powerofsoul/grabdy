import { Logger } from '@nestjs/common';

import type { TextStreamPart, ToolSet } from 'ai';

import type { Tool } from './base-tool';

export interface AgentStreamResult {
  textStream: AsyncIterable<string>;
  getFullText: () => string;
}

const logger = new Logger('AgentStream');

/**
 * Process a raw AI SDK fullStream into a text stream.
 * Converts tool calls with hooks (think, cite-sources) into text chunks.
 */
export function processStream(
  fullStream: AsyncIterable<TextStreamPart<ToolSet>>,
  hooks: Record<string, Tool>,
  logPrefix = '[stream]'
): AgentStreamResult {
  let fullText = '';
  const streamStart = Date.now();
  let textChunks = 0;
  let stepCount = 0;

  async function* generate(): AsyncIterable<string> {
    for await (const part of fullStream) {
      const elapsed = Date.now() - streamStart;

      if (part.type === 'text-delta') {
        if (textChunks === 0) {
          logger.log(`${logPrefix} First text chunk at +${elapsed}ms`);
        }
        textChunks++;
        fullText += part.text;
        yield part.text;
      } else if (part.type === 'tool-call') {
        const hook = hooks[part.toolName];
        if (hook?.onToolCall) {
          const text = hook.onToolCall(part.input);
          if (text) {
            fullText += text;
            yield text;
          }
        }
        logger.log(
          `${logPrefix} Tool call: ${part.toolName} at +${elapsed}ms args=${JSON.stringify(part.input).slice(0, 1000)}`
        );
      } else if (part.type === 'tool-result') {
        const hook = hooks[part.toolName];
        if (hook?.onToolResult) {
          const text = hook.onToolResult(part.input, part.output);
          if (text) {
            fullText += text;
            yield text;
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
    textStream: generate(),
    getFullText: () => fullText,
  };
}
