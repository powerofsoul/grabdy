import { Injectable } from '@nestjs/common';

import XLSX from 'xlsx';

import type { ExtractionResult, SheetData } from '../../../services/chunking/extractor.interface';

@Injectable()
export class XlsxExtractor {
  extract(buffer: Buffer): ExtractionResult & { type: 'sheets' } {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheets: SheetData[] = [];
    const textParts: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const csv: string = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
      textParts.push(`--- ${sheetName} ---\n${csv}`);

      const lines = csv.split('\n');
      // First non-empty line is the header row with column names
      const headerLine = lines.find((l: string) => l.trim().length > 0) ?? '';
      const columns = headerLine
        .split(',')
        .map((c: string) => c.trim())
        .filter((c: string) => c.length > 0);

      const rows = lines
        .map((line: string, i: number) => ({ row: i + 1, text: line }))
        .filter((r: { text: string }) => r.text.trim().length > 0);
      sheets.push({ sheet: sheetName, columns, rows });
    }

    return { type: 'sheets', text: textParts.join('\n\n'), sheets };
  }
}
