import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { AiCallerType, AiRequestType, CHAT_MODEL_VISION } from '@grabdy/contracts';
import { generateText } from 'ai';

import { AiUsageService } from '../../ai/ai-usage.service';
import { CHAT_VISION_LANGUAGE_MODEL } from '../../ai/bedrock.provider';

const VISION_PROMPT = `Analyze this image and provide:
1. A detailed description of the image content (2-4 sentences).
2. A list of relevant tags (comma-separated, 3-8 tags).
3. Any visible text in the image (OCR). If no text is visible, write "None".

Format your response EXACTLY as:
DESCRIPTION: <your description>
TAGS: <tag1, tag2, tag3>
TEXT: <visible text or None>`;

@Injectable()
export class ImageExtractor {
  private readonly logger = new Logger(ImageExtractor.name);

  constructor(private aiUsageService: AiUsageService) {}

  /**
   * Extract content from a standalone image file (PNG, JPEG, WebP, GIF).
   */
  async extract(buffer: Buffer, orgId: DbId<'Org'>): Promise<{ text: string }> {
    const aiResult = await generateText({
      model: CHAT_VISION_LANGUAGE_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: VISION_PROMPT },
            { type: 'image', image: new Uint8Array(buffer) },
          ],
        },
      ],
    });

    await this.aiUsageService.logUsage(
      CHAT_MODEL_VISION,
      aiResult.usage.inputTokens ?? 0,
      aiResult.usage.outputTokens ?? 0,
      AiCallerType.SYSTEM,
      AiRequestType.CHAT,
      { orgId, source: 'SYSTEM' }
    );

    return { text: aiResult.text };
  }
}
