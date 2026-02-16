import { Inject, Injectable, Logger } from '@nestjs/common';

import type { FileStorage } from '../storage/file-storage.interface';
import { FILE_STORAGE } from '../storage/file-storage.interface';

import type { ExtractedImage, ExtractionResult, PageText } from './extractor.interface';

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

/**
 * Parse word/document.xml to extract per-page text using Word's rendered page break markers.
 *
 * DOCX files contain two types of page break signals:
 * - `<w:lastRenderedPageBreak/>` — inserted by Word to mark where it rendered a page break
 * - `<w:br w:type="page"/>` — explicit hard page break inserted by the author
 *
 * We walk the XML character by character, tracking text in <w:t> elements and
 * splitting into pages at each break marker.
 */
function extractPagesFromXml(xml: string): PageText[] {
  const pages: PageText[] = [];
  let currentPageText = '';
  let currentPage = 1;

  // Simple state-machine XML parser — we only care about w:t content and page break elements
  let i = 0;
  while (i < xml.length) {
    if (xml[i] === '<') {
      // Find end of tag
      const tagEnd = xml.indexOf('>', i);
      if (tagEnd === -1) break;
      const tag = xml.slice(i, tagEnd + 1);

      // Check for page break markers
      if (
        tag.includes('lastRenderedPageBreak') ||
        (tag.includes('w:br') && tag.includes('type="page"'))
      ) {
        // Flush current page
        const trimmed = currentPageText.trim();
        if (trimmed.length > 0) {
          pages.push({ page: currentPage, text: trimmed + '\n' });
        }
        currentPage++;
        currentPageText = '';
        i = tagEnd + 1;
        continue;
      }

      // Check for <w:t> or <w:t xml:space="preserve"> opening tag
      if (tag.match(/^<w:t[ >]/)) {
        // Extract text content until </w:t>
        const closeIdx = xml.indexOf('</w:t>', tagEnd + 1);
        if (closeIdx !== -1) {
          currentPageText += xml.slice(tagEnd + 1, closeIdx);
          i = closeIdx + 6; // skip past </w:t>
          continue;
        }
      }

      // Check for paragraph end — add a newline to separate paragraphs
      if (tag === '</w:p>') {
        currentPageText += '\n';
      }

      i = tagEnd + 1;
    } else {
      i++;
    }
  }

  // Flush last page
  const trimmed = currentPageText.trim();
  if (trimmed.length > 0) {
    pages.push({ page: currentPage, text: trimmed + '\n' });
  }

  return pages;
}

@Injectable()
export class DocxExtractor {
  private readonly logger = new Logger(DocxExtractor.name);

  constructor(@Inject(FILE_STORAGE) private storage: FileStorage) {}

  async extract(storagePath: string): Promise<ExtractionResult> {
    const buffer = await this.storage.get(storagePath);
    const JSZip = require('jszip');
    const zip = await JSZip.loadAsync(buffer);

    // Try to extract per-page text from the document XML
    let pages: PageText[] = [];
    const docXml = zip.file('word/document.xml');
    if (docXml) {
      const xml: string = await docXml.async('string');
      pages = extractPagesFromXml(xml);
    }

    // Fallback: if XML parsing yielded nothing, use mammoth for plain text
    if (pages.length === 0) {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      const text: string = result.value;
      if (text.trim().length > 0) {
        pages = [{ page: 1, text: text.trim() + '\n' }];
      }
    }

    const fullText = pages.map((p) => p.text).join('');

    // Extract embedded images from the DOCX zip
    let images: ExtractedImage[] = [];
    try {
      images = await this.extractImages(zip);
    } catch (err) {
      this.logger.warn(`DOCX image extraction failed: ${err instanceof Error ? err.message : err}`);
    }

    return {
      type: 'pages',
      text: fullText,
      pages,
      images: images.length > 0 ? images : undefined,
    };
  }

  private async extractImages(zip: InstanceType<typeof import('jszip')>): Promise<ExtractedImage[]> {
    const images: ExtractedImage[] = [];

    const mediaFolder = zip.folder('word/media');
    if (!mediaFolder) return images;

    const entries: import('jszip').JSZipObject[] = [];
    mediaFolder.forEach((_relativePath, file) => {
      entries.push(file);
    });

    for (const file of entries) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!isImageExt(ext)) continue;

      try {
        const imgBuffer = Buffer.from(await file.async('nodebuffer'));
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
