import { Inject, Injectable, Logger } from '@nestjs/common';

import type { FileStorage } from '../storage/file-storage.interface';
import { FILE_STORAGE } from '../storage/file-storage.interface';

import type { ExtractedImage, ExtractionResult, PageText } from './extractor.interface';

const MAX_IMAGES_PER_DOCUMENT = 50;
const MIN_IMAGE_BYTES = 5 * 1024; // 5 KB
const MIN_IMAGE_DIMENSION = 32; // px

// pdfjs-dist OPS codes for image rendering
const OPS_PAINT_IMAGE_MASK = 83;
const OPS_PAINT_IMAGE_MASK_GROUP = 84;
const OPS_PAINT_IMAGE = 85;
const OPS_PAINT_INLINE_IMAGE = 86;
const OPS_PAINT_INLINE_IMAGE_GROUP = 87;
const OPS_PAINT_IMAGE_REPEAT = 88;
const OPS_PAINT_IMAGE_MASK_REPEAT = 89;

const IMAGE_OPS = new Set([
  OPS_PAINT_IMAGE_MASK,
  OPS_PAINT_IMAGE_MASK_GROUP,
  OPS_PAINT_IMAGE,
  OPS_PAINT_INLINE_IMAGE,
  OPS_PAINT_INLINE_IMAGE_GROUP,
  OPS_PAINT_IMAGE_REPEAT,
  OPS_PAINT_IMAGE_MASK_REPEAT,
]);

@Injectable()
export class PdfExtractor {
  private readonly logger = new Logger(PdfExtractor.name);

  constructor(@Inject(FILE_STORAGE) private storage: FileStorage) {}

  async extract(storagePath: string): Promise<ExtractionResult> {
    const buffer = await this.storage.get(storagePath);
    const pdfParse = require('pdf-parse');

    const pages: PageText[] = [];
    let pageNum = 0;

    const options = {
      pagerender: (pageData: {
        getTextContent: () => Promise<{
          items: Array<{ str: string; transform?: number[] }>;
        }>;
      }) => {
        pageNum++;
        const currentPage = pageNum;
        return pageData
          .getTextContent()
          .then((textContent: { items: Array<{ str: string; transform?: number[] }> }) => {
            const text = textContent.items
              .map((item: { str: string }) => item.str)
              .join(' ')
              .trim();
            if (text.length > 0) {
              pages.push({ page: currentPage, text: text + '\n' });
            }
            return text;
          });
      },
    };

    await pdfParse(buffer, options);
    const fullText = pages.map((p) => p.text).join('');

    // Extract images from PDF using pdfjs-dist
    let images: ExtractedImage[] = [];
    try {
      images = await this.extractImages(buffer);
    } catch (err) {
      this.logger.warn(`PDF image extraction failed: ${err instanceof Error ? err.message : err}`);
    }

    return { type: 'pages', text: fullText, pages, images: images.length > 0 ? images : undefined };
  }

  private async extractImages(buffer: Buffer): Promise<ExtractedImage[]> {
    const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
    const sharp = require('sharp');

    const path = require('path');
    const standardFontDataUrl = path.join(
      path.dirname(require.resolve('pdfjs-dist/package.json')),
      'standard_fonts/'
    );
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer), standardFontDataUrl });
    const pdfDoc = await loadingTask.promise;
    const images: ExtractedImage[] = [];
    const seenNames = new Set<string>();

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      if (images.length >= MAX_IMAGES_PER_DOCUMENT) break;

      const page = await pdfDoc.getPage(pageNum);
      const operatorList = await page.getOperatorList();

      for (let i = 0; i < operatorList.fnArray.length; i++) {
        if (images.length >= MAX_IMAGES_PER_DOCUMENT) break;

        const op = operatorList.fnArray[i];
        if (!IMAGE_OPS.has(op)) continue;

        try {
          const imgData = await this.getImageData(op, operatorList.argsArray[i], page, seenNames);
          if (!imgData) continue;

          const pngBuffer = await this.toPng(imgData, sharp);
          if (!pngBuffer) continue;

          images.push({
            buffer: pngBuffer,
            mimeType: 'image/png',
            pageNumber: pageNum,
          });
        } catch {
          // Skip individual image failures
        }
      }

      page.cleanup();
    }

    pdfDoc.destroy();
    return images;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getImageData(op: number, args: any[], page: any, seenNames: Set<string>) {
    if (op === OPS_PAINT_IMAGE || op === OPS_PAINT_IMAGE_REPEAT) {
      const imgName: string = args[0];
      if (seenNames.has(imgName)) return null;
      seenNames.add(imgName);
      return page.objs.get(imgName);
    }

    if (op === OPS_PAINT_INLINE_IMAGE || op === OPS_PAINT_INLINE_IMAGE_GROUP) {
      // Inline images have data directly in the args
      return args[0];
    }

    if (op === OPS_PAINT_IMAGE_MASK || op === OPS_PAINT_IMAGE_MASK_REPEAT) {
      return args[0];
    }

    if (op === OPS_PAINT_IMAGE_MASK_GROUP) {
      // Group contains array of images; extract first valid one
      const group: unknown[] = args[0];
      if (!Array.isArray(group)) return null;
      for (const entry of group) {
        if (
          entry &&
          typeof entry === 'object' &&
          'data' in entry &&
          'width' in entry &&
          'height' in entry
        ) {
          return entry;
        }
      }
      return null;
    }

    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async toPng(imgData: any, sharp: any): Promise<Buffer | null> {
    if (!imgData || !imgData.data || !imgData.width || !imgData.height) return null;

    const width: number = imgData.width;
    const height: number = imgData.height;
    if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) return null;

    const channels = Math.round(imgData.data.length / (width * height));
    if (channels < 1 || channels > 4) return null;

    const pngBuffer: Buffer = await sharp(Buffer.from(imgData.data), {
      raw: { width, height, channels },
    })
      .png()
      .toBuffer();

    if (pngBuffer.length < MIN_IMAGE_BYTES) return null;

    return pngBuffer;
  }
}
