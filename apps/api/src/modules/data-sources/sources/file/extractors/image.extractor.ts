import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { AiRequestType, IMAGE_VISION_MODEL } from '@grabdy/contracts';

import { AiService } from '../../../../ai/ai.service';
import { IMAGE_VISION_LANGUAGE_MODEL } from '../../../../ai/bedrock.provider';

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

  constructor(private aiService: AiService) {}

  /**
   * Extract content from a standalone image file (PNG, JPEG, WebP, GIF).
   */
  async extract(buffer: Buffer, orgId: DbId<'Org'>): Promise<{ text: string }> {
    const aiResult = await this.aiService.generateText(
      {
        model: IMAGE_VISION_LANGUAGE_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: VISION_PROMPT },
              { type: 'image', image: new Uint8Array(buffer) },
            ],
          },
        ],
      },
      IMAGE_VISION_MODEL,
      AiRequestType.IMAGE_ANALYSIS,
      { orgId, source: 'SYSTEM', description: 'OCR and describe uploaded image' }
    );

    return { text: aiResult.text };
  }
}
