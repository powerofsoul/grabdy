import { Inject, Injectable, Logger } from '@nestjs/common';

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { FileStorage } from '../storage/file-storage.interface';
import { FILE_STORAGE } from '../storage/file-storage.interface';

import type { ExtractionResult, PageText } from './extractor.interface';

const execFileAsync = promisify(execFile);

@Injectable()
export class PdfExtractor {
  private readonly logger = new Logger(PdfExtractor.name);

  constructor(@Inject(FILE_STORAGE) private storage: FileStorage) {}

  async extract(storagePath: string): Promise<ExtractionResult> {
    const tempFile = await this.storage.getTempPath(storagePath);

    try {
      const pages = await this.extractText(tempFile.path);
      const fullText = pages.map((p) => p.text).join('');
      return { type: 'pages', text: fullText, pages };
    } finally {
      await tempFile.cleanup();
    }
  }

  /**
   * Extract text page-by-page using `pdftotext` from poppler-utils.
   * The PDF is processed entirely in native code — nothing is loaded into the JS heap.
   */
  private async extractText(filePath: string): Promise<PageText[]> {
    // Get page count from pdfinfo
    const { stdout: infoOut } = await execFileAsync('pdfinfo', [filePath]);
    const pagesMatch = /Pages:\s+(\d+)/.exec(infoOut);
    if (!pagesMatch) {
      throw new Error('Could not determine PDF page count');
    }
    const numPages = parseInt(pagesMatch[1], 10);

    const pages: PageText[] = [];

    for (let page = 1; page <= numPages; page++) {
      const { stdout } = await execFileAsync('pdftotext', [
        '-f',
        String(page),
        '-l',
        String(page),
        '-layout',
        filePath,
        '-', // output to stdout
      ]);

      const text = stdout.trim();
      if (text.length > 0) {
        pages.push({ page, text: text + '\n' });
      }
    }

    return pages;
  }
}
