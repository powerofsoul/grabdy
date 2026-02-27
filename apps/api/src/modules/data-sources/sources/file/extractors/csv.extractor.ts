import { Injectable } from '@nestjs/common';

import type { ExtractionResult, SheetRow } from '../../../services/chunking/extractor.interface';

@Injectable()
export class CsvExtractor {
  extract(buffer: Buffer): ExtractionResult & { type: 'rows' } {
    const text = buffer.toString('utf-8');
    const lines = text.split('\n');
    // First non-empty line is the header row with column names
    const headerLine = lines.find((l) => l.trim().length > 0) ?? '';
    const columns = headerLine
      .split(',')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    const rows: SheetRow[] = lines
      .map((line, i) => ({ row: i + 1, text: line }))
      .filter((r) => r.text.trim().length > 0);
    return { type: 'rows', text, columns, rows };
  }
}
