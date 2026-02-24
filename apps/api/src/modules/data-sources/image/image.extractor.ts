import { Injectable, Logger } from '@nestjs/common';

import { openai } from '@ai-sdk/openai';
import type { DbId } from '@grabdy/common';
import { AiCallerType, AiRequestType } from '@grabdy/contracts';
import { generateText } from 'ai';
import { readFile } from 'node:fs/promises';

import { AiUsageService } from '../../ai/ai-usage.service';
import { StorageKeys } from '../../storage/file-storage.interface';
import { S3FileStorage } from '../../storage/s3-file-storage';
import type { ImageOnDisk } from '../pdf/pdf.extractor';

const VISION_PROMPT = `Analyze this image and provide:
1. A detailed description of the image content (2-4 sentences).
2. A list of relevant tags (comma-separated, 3-8 tags).
3. Any visible text in the image (OCR). If no text is visible, write "None".

Format your response EXACTLY as:
DESCRIPTION: <your description>
TAGS: <tag1, tag2, tag3>
TEXT: <visible text or None>`;

interface ImageChunk {
  content: string;
  metadata: { type: 'PDF'; pages: number[]; imageStorageKey: string } | { type: 'IMAGE' };
  sourceUrl: string | null;
  sourceKey: string | null;
}

@Injectable()
export class ImageExtractor {
  private readonly logger = new Logger(ImageExtractor.name);

  constructor(
    private storage: S3FileStorage,
    private aiUsageService: AiUsageService
  ) {}

  /**
   * Extract content from a standalone image file (PNG, JPEG, WebP, GIF).
   */
  async extract(buffer: Buffer, orgId: DbId<'Org'>): Promise<{ text: string }> {
    const aiResult = await generateText({
      model: openai('gpt-4o-mini'),
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
      'openai/gpt-4o-mini',
      aiResult.usage.inputTokens ?? 0,
      aiResult.usage.outputTokens ?? 0,
      AiCallerType.SYSTEM,
      AiRequestType.CHAT,
      { orgId, source: 'SYSTEM' }
    );

    return { text: aiResult.text };
  }

  /**
   * Analyze images extracted from a PDF: upload each to storage, run vision AI,
   * and return chunks with metadata. Caller is responsible for image cleanup.
   */
  async analyzeImages(
    images: ImageOnDisk[],
    orgId: DbId<'Org'>,
    collectionId: DbId<'Collection'> | null,
    dataSourceId: DbId<'DataSource'>,
    source: { sourceUrl: string | null; sourceKey: string | null }
  ): Promise<ImageChunk[]> {
    const imageChunks: ImageChunk[] = [];
    let totalImageInputTokens = 0;
    let totalImageOutputTokens = 0;

    for (let imgIdx = 0; imgIdx < images.length; imgIdx++) {
      const img = images[imgIdx];
      try {
        const imageData = await readFile(img.filePath);

        const imageKey = StorageKeys.extractedImage(
          orgId,
          collectionId,
          dataSourceId,
          img.page,
          imgIdx
        );
        await this.storage.put(imageKey, Buffer.from(imageData), 'image/png');

        const visionResult = await generateText({
          model: openai('gpt-4o-mini'),
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: VISION_PROMPT },
                { type: 'image', image: new Uint8Array(imageData) },
              ],
            },
          ],
        });

        totalImageInputTokens += visionResult.usage.inputTokens ?? 0;
        totalImageOutputTokens += visionResult.usage.outputTokens ?? 0;

        imageChunks.push({
          content: visionResult.text,
          metadata: { type: 'PDF', pages: [img.page], imageStorageKey: imageKey },
          ...source,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to analyze image on page ${img.page}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    if (totalImageInputTokens > 0) {
      await this.aiUsageService.logUsage(
        'openai/gpt-4o-mini',
        totalImageInputTokens,
        totalImageOutputTokens,
        AiCallerType.SYSTEM,
        AiRequestType.CHAT,
        { orgId, source: 'SYSTEM' }
      );
    }

    return imageChunks;
  }
}
