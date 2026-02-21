import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import type { AiRequestSource, CanvasState } from '@grabdy/contracts';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { CanvasAgentFactory } from '../services/canvas-agent.factory';

@Injectable()
export class CanvasDelegateTool {
  private readonly logger = new Logger(CanvasDelegateTool.name);

  constructor(private canvasAgentFactory: CanvasAgentFactory) {}

  create(opts: {
    orgId: DbId<'Org'>;
    userId: DbId<'User'>;
    threadId: DbId<'ChatThread'>;
    source: AiRequestSource;
    canvasState?: CanvasState;
  }) {
    const factory = this.canvasAgentFactory;
    const logger = this.logger;

    const canvasDelegate = createTool({
      id: 'canvas_delegate',
      description:
        'Create visual cards on the canvas from structured data. Pass the search context and what to visualize. A specialized canvas agent will create the cards.',
      inputSchema: z.object({
        context: z
          .string()
          .describe(
            'The relevant search results and data to visualize. Include all facts, numbers, and source metadata the canvas needs.'
          ),
        intent: z
          .string()
          .describe(
            'What to visualize: e.g. "comparison table of features", "timeline of events", "KPI cards for revenue metrics"'
          ),
      }),
      execute: async (input) => {
        logger.log(
          `[canvas_delegate] Delegating to canvas agent: intent="${input.intent}", context=${input.context.length} chars`
        );

        const agent = factory.create({
          orgId: opts.orgId,
          userId: opts.userId,
          threadId: opts.threadId,
          source: opts.source,
          canvasState: opts.canvasState,
        });

        const prompt = `Based on the following data, create appropriate canvas cards.\n\nIntent: ${input.intent}\n\nData:\n${input.context}`;

        const result = await agent.generate(prompt);

        // Extract canvas_update tool results from all steps
        const canvasOps: Array<{ args: unknown; result: unknown }> = [];

        logger.log(
          `[canvas_delegate] Canvas agent result: ${result.steps.length} steps, text=${result.text.length} chars`
        );

        for (const step of result.steps) {
          logger.log(
            `[canvas_delegate] Step: ${step.toolResults.length} tool results, ${step.toolCalls.length} tool calls`
          );
          for (const tr of step.toolResults) {
            logger.log(
              `[canvas_delegate] Tool result: ${tr.payload.toolName} isError=${tr.payload.isError ?? false}`
            );
            if (tr.payload.toolName === 'canvas_update') {
              canvasOps.push({
                args: tr.payload.args,
                result: tr.payload.result,
              });
            }
          }
        }

        logger.log(`[canvas_delegate] Returning ${canvasOps.length} canvas operations`);

        return { operations: canvasOps };
      },
    });

    return { canvas_delegate: canvasDelegate };
  }
}
