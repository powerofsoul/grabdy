import { Injectable } from '@nestjs/common';

import { tool } from 'ai';
import { z } from 'zod';

import type { Tool } from '../base-tool';

/**
 * A "think" tool that lets the model express its reasoning as a tool call.
 * GPT models emit either text or tool calls per turn, never both interleaved.
 * This tool gives the model a way to show reasoning between search steps.
 */
@Injectable()
export class ThinkTool implements Tool {
  create() {
    return tool({
      description:
        'MANDATORY: You MUST call this tool at every step. The user sees a blank loading screen until you call think. ' +
        'Call think BEFORE every rag-search call to state what you will search for. ' +
        'Call think AFTER every rag-search result to state what you found. ' +
        'Call think BEFORE your final answer to state your conclusion. ' +
        'Never skip this tool. The user cannot see your progress without it.',
      inputSchema: z.object({
        thought: z
          .string()
          .describe(
            'Your reasoning: what you plan to search, what you found, which sources matched, whether you need more searches.'
          ),
      }),
      execute: async () => {
        return { ok: true };
      },
    });
  }

  onToolCall(input: unknown): string | null {
    if (input && typeof input === 'object' && 'thought' in input) {
      const thought = String(input.thought);
      if (thought) {
        return `\`\`\`reasoning\n${thought}\n\`\`\`\n`;
      }
    }
    return null;
  }
}
