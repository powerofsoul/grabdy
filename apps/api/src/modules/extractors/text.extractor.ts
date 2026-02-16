import { Inject, Injectable } from '@nestjs/common';

import type { FileStorage } from '../storage/file-storage.interface';
import { FILE_STORAGE } from '../storage/file-storage.interface';

import type { ExtractionResult, SheetRow } from './extractor.interface';

@Injectable()
export class TextExtractor {
  constructor(@Inject(FILE_STORAGE) private storage: FileStorage) {}

  async extract(storagePath: string): Promise<ExtractionResult> {
    const buffer = await this.storage.get(storagePath);
    return { type: 'text', text: buffer.toString('utf-8') };
  }

  async extractCsv(storagePath: string): Promise<ExtractionResult & { type: 'rows' }> {
    const buffer = await this.storage.get(storagePath);
    const text = buffer.toString('utf-8');
    const lines = text.split('\n');
    // First non-empty line is the header row with column names
    const headerLine = lines.find((l) => l.trim().length > 0) ?? '';
    const columns = headerLine.split(',').map((c) => c.trim()).filter((c) => c.length > 0);

    const rows: SheetRow[] = lines
      .map((line, i) => ({ row: i + 1, text: line }))
      .filter((r) => r.text.trim().length > 0);
    return { type: 'rows', text, columns, rows };
  }
}
