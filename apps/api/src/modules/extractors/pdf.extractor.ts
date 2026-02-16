import { Inject, Injectable, Logger } from '@nestjs/common';

import type { FileStorage } from '../storage/file-storage.interface';
import { FILE_STORAGE } from '../storage/file-storage.interface';

import type { ExtractedImage, ExtractionResult, PageText } from './extractor.interface';

const MAX_IMAGES_PER_DOCUMENT = 50;
const MIN_IMAGE_BYTES = 5 * 1024; // 5 KB
const MIN_IMAGE_DIMENSION = 32; // px

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
          .then(
            (textContent: {
              items: Array<{ str: string; transform?: number[] }>;
            }) => {
              const text = textContent.items
                .map((item: { str: string }) => item.str)
                .join(' ')
                .trim();
              if (text.length > 0) {
                pages.push({ page: currentPage, text: text + '\n' });
              }
              return text;
            }
          );
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

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
    const pdfDoc = await loadingTask.promise;
    const images: ExtractedImage[] = [];

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      if (images.length >= MAX_IMAGES_PER_DOCUMENT) break;

      const page = await pdfDoc.getPage(pageNum);
      const operatorList = await page.getOperatorList();

      for (let i = 0; i < operatorList.fnArray.length; i++) {
        if (images.length >= MAX_IMAGES_PER_DOCUMENT) break;

        // OPS.paintImageXObject = 85
        if (operatorList.fnArray[i] !== 85) continue;

        const imgName = operatorList.argsArray[i][0];
        try {
          const imgData = await page.objs.get(imgName);
          if (!imgData || !imgData.data || !imgData.width || !imgData.height) continue;

          const width = imgData.width;
          const height = imgData.height;
          if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) continue;

          // Convert raw pixel data to PNG using sharp
          const channels = imgData.data.length / (width * height);
          const pngBuffer: Buffer = await sharp(Buffer.from(imgData.data), {
            raw: { width, height, channels: Math.round(channels) },
          })
            .png()
            .toBuffer();

          if (pngBuffer.length < MIN_IMAGE_BYTES) continue;

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
}
