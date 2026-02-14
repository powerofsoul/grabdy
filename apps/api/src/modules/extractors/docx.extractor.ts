import { Inject, Injectable, Logger } from '@nestjs/common';

import type { FileStorage } from '../storage/file-storage.interface';
import { FILE_STORAGE } from '../storage/file-storage.interface';

import type { ExtractedImage, ExtractionResult } from './extractor.interface';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);

const EXT_TO_MIME: Record<'png' | 'jpg' | 'jpeg' | 'gif' | 'webp', string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

function isImageExt(ext: string): ext is keyof typeof EXT_TO_MIME {
  return IMAGE_EXTENSIONS.has(ext);
}

@Injectable()
export class DocxExtractor {
  private readonly logger = new Logger(DocxExtractor.name);

  constructor(@Inject(FILE_STORAGE) private storage: FileStorage) {}

  async extract(storagePath: string): Promise<ExtractionResult> {
    const buffer = await this.storage.get(storagePath);
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });

    // Extract embedded images from the DOCX zip
    let images: ExtractedImage[] = [];
    try {
      images = await this.extractImages(buffer);
    } catch (err) {
      this.logger.warn(`DOCX image extraction failed: ${err instanceof Error ? err.message : err}`);
    }

    return {
      text: result.value,
      images: images.length > 0 ? images : undefined,
    };
  }

  private async extractImages(buffer: Buffer): Promise<ExtractedImage[]> {
    const JSZip = require('jszip');
    const zip = await JSZip.loadAsync(buffer);
    const images: ExtractedImage[] = [];

    const mediaFolder = zip.folder('word/media');
    if (!mediaFolder) return images;

    const entries: Array<{ name: string; async: (type: string) => Promise<Buffer> }> = [];
    mediaFolder.forEach((_relativePath: string, file: { name: string; async: (type: string) => Promise<Buffer> }) => {
      entries.push(file);
    });

    for (const file of entries) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!isImageExt(ext)) continue;

      try {
        const imgBuffer: Buffer = await file.async('nodebuffer');
        images.push({
          buffer: imgBuffer,
          mimeType: EXT_TO_MIME[ext],
        });
      } catch {
        // Skip individual image failures
      }
    }

    return images;
  }
}
