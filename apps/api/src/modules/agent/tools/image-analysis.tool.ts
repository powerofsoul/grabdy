import { Injectable, Logger } from '@nestjs/common';

import type { StreamChunk } from '@grabdy/contracts';
import { AiRequestType, CHAT_MODEL_VISION } from '@grabdy/contracts';
import { tool } from 'ai';
import { z } from 'zod';

import type { AiCallContext } from '../../ai/ai.service';
import { AiService } from '../../ai/ai.service';
import { CHAT_VISION_LANGUAGE_MODEL } from '../../ai/bedrock.provider';
import type { Tool, ToolCallContext } from '../base-tool';

const imageAnalysisInputSchema = z.object({
  reasoning: z.string().describe("Explain what you're looking for in this image and why."),
  fileName: z.string().describe('The file name of the attached image to analyze'),
  question: z
    .string()
    .describe(
      'What you want to know about the image, e.g. "Describe what is in this image" or "What text is visible?"'
    ),
});

const imageAnalysisOutputSchema = z.union([
  z.object({ description: z.string() }),
  z.object({ error: z.string() }),
]);

type ImageAnalysisInput = z.infer<typeof imageAnalysisInputSchema>;
type ImageAnalysisOutput = z.infer<typeof imageAnalysisOutputSchema>;

export interface ImageStore {
  images: Array<{ fileName: string; image: Buffer; mimeType: string }>;
}

@Injectable()
export class ImageAnalysisTool implements Tool<ImageAnalysisInput, ImageAnalysisOutput> {
  readonly toolName = 'analyze-image' as const;
  private readonly logger = new Logger(ImageAnalysisTool.name);

  constructor(private aiService: AiService) {}

  create(imageStore: ImageStore, ctx: AiCallContext) {
    const logger = this.logger;
    const aiService = this.aiService;

    return tool({
      description: `Analyze an attached image using a vision model. Call this tool when the user uploads an image and you need to see what's in it. Pass the image file name and a question about what you want to know. Available images: ${imageStore.images.map((img) => img.fileName).join(', ') || 'none'}`,
      inputSchema: imageAnalysisInputSchema,
      outputSchema: imageAnalysisOutputSchema,
      execute: async ({ fileName, question, reasoning: _reasoning }) => {
        const img = imageStore.images.find((i) => i.fileName === fileName);
        if (!img) {
          return {
            error: `Image "${fileName}" not found. Available: ${imageStore.images.map((i) => i.fileName).join(', ')}`,
          };
        }

        try {
          const result = await aiService.generateText(
            {
              model: CHAT_VISION_LANGUAGE_MODEL,
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: question },
                    { type: 'image', image: new Uint8Array(img.image) },
                  ],
                },
              ],
            },
            CHAT_MODEL_VISION,
            AiRequestType.CHAT,
            ctx
          );

          return { description: result.text };
        } catch (err) {
          logger.error(
            `Image analysis failed for ${fileName}: ${err instanceof Error ? err.message : String(err)}`
          );
          return { error: 'Failed to analyze image' };
        }
      },
    });
  }

  onToolCall(ctx: ToolCallContext<ImageAnalysisInput>): StreamChunk | null {
    if (ctx.input.reasoning) {
      return { type: 'thinking', text: ctx.input.reasoning };
    }
    return null;
  }
}
