import { Inject, Injectable, Logger } from '@nestjs/common';

import { openai } from '@ai-sdk/openai';
import type { DbId } from '@grabdy/common';
import { AiCallerType, AiRequestType, type ModelId } from '@grabdy/contracts';
import { generateText } from 'ai';

import { AiUsageService } from '../ai/ai-usage.service';
import type { FileStorage } from '../storage/file-storage.interface';
import { FILE_STORAGE } from '../storage/file-storage.interface';

import type { ExtractionResult } from './extractor.interface';

const IMAGE_ANALYSIS_PROMPT = `Analyze this image and provide:
1. A detailed description of the image content (2-4 sentences). Include what the image shows, any charts/graphs/diagrams, data presented, and key visual elements.
2. A list of relevant tags (comma-separated, 3-8 tags). Tags should describe the content type, subject matter, and key themes.
3. Any visible text in the image (OCR). If no text is visible, write "None".

Format your response EXACTLY as:
DESCRIPTION: <your description>
TAGS: <tag1, tag2, tag3>
TEXT: <visible text or None>`;

interface ImageMetadata {
  description: string;
  tags: string[];
  visibleText: string | null;
}

function parseImageAnalysis(response: string): ImageMetadata {
  const descMatch = /DESCRIPTION:\s*(.+?)(?=\nTAGS:)/s.exec(response);
  const tagsMatch = /TAGS:\s*(.+?)(?=\nTEXT:)/s.exec(response);
  const textMatch = /TEXT:\s*(.+)/s.exec(response);

  const description = descMatch ? descMatch[1].trim() : response.trim();
  const tagsStr = tagsMatch ? tagsMatch[1].trim() : '';
  const tags = tagsStr
    ? tagsStr
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
    : [];
  const visibleText = textMatch ? textMatch[1].trim() : null;

  return {
    description,
    tags,
    visibleText: visibleText === 'None' ? null : visibleText,
  };
}

const VISION_MODEL = 'openai/gpt-4o-mini' satisfies ModelId;

@Injectable()
export class ImageExtractor {
  private readonly logger = new Logger(ImageExtractor.name);

  constructor(
    @Inject(FILE_STORAGE) private storage: FileStorage,
    private aiUsageService: AiUsageService
  ) {}

  async extract(storagePath: string): Promise<ExtractionResult> {
    const meta = await this.extractWithMetadata(storagePath);
    return { type: 'text', text: meta.text };
  }

  async extractWithMetadata(
    storagePath: string,
    orgId?: DbId<'Org'>
  ): Promise<{ text: string; aiTags: string[]; aiDescription: string }> {
    const buffer = await this.storage.get(storagePath);

    const { text: response, usage } = await generateText({
      model: openai('gpt-4o-mini'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: IMAGE_ANALYSIS_PROMPT },
            {
              type: 'image',
              image: new Uint8Array(buffer),
            },
          ],
        },
      ],
    });

    // Log AI usage
    if (orgId) {
      this.aiUsageService
        .logUsage(
          VISION_MODEL,
          usage.inputTokens ?? 0,
          usage.outputTokens ?? 0,
          AiCallerType.SYSTEM,
          AiRequestType.CHAT,
          { orgId, source: 'SYSTEM' }
        )
        .catch((err) => this.logger.error(`Usage logging failed: ${err}`));
    }

    const parsed = parseImageAnalysis(response);
    this.logger.log(
      `Image analysis: ${parsed.tags.length} tags, ${parsed.description.length} chars description`
    );

    // Combine description and visible text for RAG embedding
    const parts = [parsed.description];
    if (parsed.visibleText) {
      parts.push(`Visible text: ${parsed.visibleText}`);
    }
    if (parsed.tags.length > 0) {
      parts.push(`Tags: ${parsed.tags.join(', ')}`);
    }

    return {
      text: parts.join('\n\n'),
      aiTags: parsed.tags,
      aiDescription: parsed.description,
    };
  }
}
