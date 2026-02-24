import { Injectable, Logger } from '@nestjs/common';

import { execFile } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { promisify } from 'node:util';

import type { PageText } from '../chunking/extractor.interface';

const execFileAsync = promisify(execFile);

export interface ImageOnDisk {
  page: number;
  filePath: string;
}

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
   * Extract text from a page range. Works on a local file path.
   */
  async extractPageRangeFromFile(
    filePath: string,
    startPage: number,
    endPage: number
  ): Promise<PageText[]> {
    const pages: PageText[] = [];
    for (let page = startPage; page <= endPage; page++) {
      const { stdout } = await execFileAsync('pdftotext', [
        '-f',
        String(page),
        '-l',
        String(page),
        '-layout',
        filePath,
        '-',
      ]);
      const text = stdout.trim();
      if (text.length > 0) {
        pages.push({ page, text: text + '\n' });
      }
    }
    return pages;
  }

  /**
   * Extract embedded images from a PDF page range using `pdfimages` (poppler-utils).
   * Works on a local file path. Returns file paths on disk and a cleanup function.
   */
  async extractImagesToDiskFromFile(
    filePath: string,
    startPage: number,
    endPage: number
  ): Promise<{ images: ImageOnDisk[]; cleanup: () => Promise<void> }> {
    const outDir = `${filePath}-images-${startPage}-${endPage}`;

    const cleanup = async () => {
      await execFileAsync('rm', ['-rf', outDir]).catch(() => {});
    };

    try {
      await execFileAsync('mkdir', ['-p', outDir]);
      await execFileAsync('pdfimages', [
        '-png',
        '-p',
        '-f',
        String(startPage),
        '-l',
        String(endPage),
        filePath,
        `${outDir}/img`,
      ]);

      const files = await readdir(outDir);
      const pngFiles = files.filter((f) => f.endsWith('.png')).sort();

      const images: ImageOnDisk[] = [];

      for (const filename of pngFiles) {
        // pdfimages with -p outputs: img-{page}-{index}.png
        const match = /^img-(\d+)-\d+\.png$/.exec(filename);
        if (!match) continue;

        const imgPath = `${outDir}/${filename}`;
        const { size } = await stat(imgPath);

        // Skip tiny images (icons, decorations, spacers)
        if (size < 5000) continue;

        images.push({ page: parseInt(match[1], 10), filePath: imgPath });
      }

      return { images, cleanup };
    } catch {
      this.logger.debug(`pdfimages returned no images for pages ${startPage}-${endPage}`);
      await cleanup();
      return { images: [], cleanup: async () => {} };
    }
  }
}
