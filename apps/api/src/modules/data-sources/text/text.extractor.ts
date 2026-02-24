import { Injectable } from '@nestjs/common';

import type { ExtractionResult } from '../chunking/extractor.interface';

@Injectable()
export class TextExtractor {
  extract(buffer: Buffer): ExtractionResult {
    return { type: 'text', text: buffer.toString('utf-8') };
  }
}
