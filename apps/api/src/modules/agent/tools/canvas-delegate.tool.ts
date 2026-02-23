import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import type { AiRequestSource, CanvasState } from '@grabdy/contracts';
import { AiCallerType, AiRequestType, CHAT_MODEL } from '@grabdy/contracts';
import { stepCountIs, tool, ToolLoopAgent } from 'ai';
import { z } from 'zod';

import { AiUsageService } from '../../ai/ai-usage.service';
import { CHAT_LANGUAGE_MODEL } from '../../ai/bedrock.provider';
import { CANVAS_INSTRUCTIONS, summarizeCanvas } from '../../chat/canvas-prompt';

import { CanvasTools } from './canvas-tools';

@Injectable()
export class CanvasDelegateTool {
  private readonly logger = new Logger(CanvasDelegateTool.name);

  constructor(
    private canvasTools: CanvasTools,
    private aiUsageService: AiUsageService
  ) {}

  create(opts: {
    orgId: DbId<'Org'>;
    userId: DbId<'User'>;
    threadId: DbId<'ChatThread'>;
    source: AiRequestSource;
    canvasState?: CanvasState;
  }) {
    const canvasTools = this.canvasTools;
    const aiUsageService = this.aiUsageService;
    const logger = this.logger;

    const canvasDelegate = tool({
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

        const parts = [CANVAS_INSTRUCTIONS];
        if (opts.canvasState && opts.canvasState.cards.length > 0) {
          parts.push(summarizeCanvas(opts.canvasState));
        }
        const instructions = parts.join('\n\n');

        const tools = canvasTools.create(opts.threadId, opts.orgId);

        const prompt = `Based on the following data, create appropriate canvas cards.\n\nIntent: ${input.intent}\n\nData:\n${input.context}`;

        const canvasAgent = new ToolLoopAgent({
          id: 'canvas-agent',
          model: CHAT_LANGUAGE_MODEL,
          instructions,
          tools,
          stopWhen: stepCountIs(10),
          onStepFinish: ({ usage }) => {
            aiUsageService
              .logUsage(
                CHAT_MODEL,
                usage.inputTokens ?? 0,
                usage.outputTokens ?? 0,
                AiCallerType.MEMBER,
                AiRequestType.CHAT,
                { orgId: opts.orgId, userId: opts.userId, source: opts.source }
              )
              .catch((err) => logger.error(`Usage logging failed: ${err}`));
          },
        });

        const result = await canvasAgent.generate({ prompt });

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
            logger.log(`[canvas_delegate] Tool result: ${tr.toolName} type=${tr.type}`);
            if (tr.toolName === 'canvas_update') {
              canvasOps.push({
                args: tr.input,
                result: tr.output,
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
