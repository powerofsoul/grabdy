import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { AiRequestType, IMAGE_VISION_MODEL } from '@grabdy/contracts';

import { AiService } from '../../../../ai/ai.service';
import { IMAGE_VISION_LANGUAGE_MODEL } from '../../../../ai/bedrock.provider';
import {
  type ImageAnalysis,
  imageAnalysisSchema,
  VISION_SYSTEM_PROMPT,
} from '../../../services/enrichment.service';

@Injectable()
export class ImageExtractor {
  private readonly logger = new Logger(ImageExtractor.name);

  constructor(private aiService: AiService) {}

  /**
   * Extract content from a standalone image file (PNG, JPEG, WebP, GIF).
   */
  async extract(buffer: Buffer, orgId: DbId<'Org'>): Promise<{ text: string }> {
    const analysis = await this.aiService.generateStructuredObject(
      imageAnalysisSchema,
      {
        model: IMAGE_VISION_LANGUAGE_MODEL,
        system: VISION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [{ type: 'image', image: new Uint8Array(buffer) }],
          },
        ],
      },
      IMAGE_VISION_MODEL,
      AiRequestType.IMAGE_ANALYSIS,
      { orgId, source: 'SYSTEM', description: 'OCR and describe uploaded image' }
    );

    return { text: formatImageDescription(analysis) };
  }
}

function formatImageDescription(analysis: ImageAnalysis): string {
  const parts = [`[${analysis.type}] ${analysis.description}`];
  if (analysis.visibleText) parts.push(`Text: ${analysis.visibleText}`);
  if (analysis.dataValues) parts.push(`Data: ${analysis.dataValues}`);
  if (analysis.relationships) parts.push(`Relationships: ${analysis.relationships}`);
  return parts.join(' ');
}
