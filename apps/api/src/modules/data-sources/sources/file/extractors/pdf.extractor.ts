import { Injectable, Logger } from '@nestjs/common';

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { PageText } from '../../../services/chunking/extractor.interface';

const execFileAsync = promisify(execFile);

@Injectable()
export class PdfExtractor {
  private readonly logger = new Logger(PdfExtractor.name);

  /**
   * Lightweight page count via `pdfinfo`.
   */
  async getPageCountFromFile(filePath: string): Promise<number> {
    const { stdout } = await execFileAsync('pdfinfo', [filePath]);
    const match = /Pages:\s+(\d+)/.exec(stdout);
    if (!match) {
      throw new Error('Could not determine PDF page count');
    }
    return parseInt(match[1], 10);
  }

  /**
   * Extract text from a page range. Calls pdftotext once for the whole range
   * and splits output on form-feed characters for per-page text.
   */
  async extractPageRangeFromFile(
    filePath: string,
    startPage: number,
    endPage: number
  ): Promise<PageText[]> {
    const { stdout } = await execFileAsync('pdftotext', [
      '-f',
      String(startPage),
      '-l',
      String(endPage),
      '-layout',
      filePath,
      '-',
    ]);

    const pages: PageText[] = [];
    const rawPages = stdout.split('\f');

    for (let i = 0; i < rawPages.length; i++) {
      const text = rawPages[i].trim();
      if (text.length > 0) {
        pages.push({ page: startPage + i, text: text + '\n' });
      }
    }
    return pages;
  }
}
