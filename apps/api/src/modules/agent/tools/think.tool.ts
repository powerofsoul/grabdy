import { Injectable } from '@nestjs/common';

import type { StreamChunk } from '@grabdy/contracts';
import { tool } from 'ai';
import { z } from 'zod';

import type { Tool, ToolCallContext } from '../base-tool';

const inputSchema = z.object({
  thought: z
    .string()
    .describe('Your reasoning: what you found, what it means, what gaps remain, what to do next.'),
});

type Input = z.infer<typeof inputSchema>;
type Output = { ok: boolean };

@Injectable()
export class ThinkTool implements Tool<Input, Output> {
  readonly toolName = 'think' as const;

  create() {
    return tool({
      description:
        'Optional scratchpad for extra reasoning between searches. ' +
        'Use when you need to reason about results, plan next steps, or work through a complex question. ' +
        'The user sees your thoughts as a progress indicator.',
      inputSchema,
      execute: async () => {
        return { ok: true };
      },
    });
  }

  onToolCall(ctx: ToolCallContext<Input>): StreamChunk | null {
    if (ctx.input.thought) {
      return { type: 'thinking', text: ctx.input.thought };
    }
    return null;
  }
}
