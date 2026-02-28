import { Injectable } from '@nestjs/common';

import XLSX from 'xlsx';

import type {
  BatchExtractionResult,
  DocumentMetadata,
  ExtractionResult,
  SheetData,
} from '../../../services/chunking/extractor.interface';

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

  /**
   * Get document metadata for batch planning.
   * Returns row count per sheet and sheet names.
   */
  getDocumentMetadata(buffer: Buffer): DocumentMetadata {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetNames = workbook.SheetNames;
    let totalRows = 0;

    for (const sheetName of sheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const range = sheet['!ref'];
      if (!range) continue;
      const decoded = XLSX.utils.decode_range(range);
      totalRows += decoded.e.r - decoded.s.r + 1;
    }

    return {
      rowCount: totalRows,
      sheetNames,
      fileSize: buffer.length,
    };
  }

  /**
   * Extract rich content from a batch of XLSX rows within a specific sheet.
   *
   * @param buffer - The full XLSX file buffer
   * @param sheet - Sheet name to extract from
   * @param startRow - First row of the primary range (1-based)
   * @param endRow - Last row of the primary range (1-based, inclusive)
   * @param overlapBefore - Number of overlap rows before startRow
   * @param overlapAfter - Number of overlap rows after endRow
   */
  extractBatch(
    buffer: Buffer,
    sheet: string,
    startRow: number,
    endRow: number,
    overlapBefore: number,
    overlapAfter: number
  ): BatchExtractionResult {
    const result: BatchExtractionResult = {
      textSegments: [],
      highlights: [],
      comments: [],
      annotations: [],
      images: [],
      formFields: [],
      footnotes: [],
      trackChanges: [],
      headings: [],
    };

    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellStyles: true,
      cellNF: true,
    });

    const ws = workbook.Sheets[sheet];
    if (!ws) return result;

    const range = ws['!ref'];
    if (!range) return result;

    const decoded = XLSX.utils.decode_range(range);
    const maxRow = decoded.e.r + 1; // 1-based
    const maxCol = decoded.e.c;

    const effectiveStart = Math.max(1, startRow - overlapBefore);
    const effectiveEnd = Math.min(maxRow, endRow + overlapAfter);

    // Always include header row (row 1) as a non-context text segment
    const headerCells: string[] = [];
    for (let c = decoded.s.c; c <= maxCol; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      const cell = ws[addr];
      headerCells.push(cell ? String(cell.v ?? '') : '');
    }
    const headerText = headerCells.join(',');
    if (headerText.trim().length > 0) {
      result.textSegments.push({
        content: headerText,
        unit: 1,
        contextOnly: false,
      });
    }

    // Extract merged cell ranges that overlap with our batch range
    const merges = ws['!merges'] ?? [];
    for (const merge of merges) {
      const mergeStartRow = merge.s.r + 1; // 1-based
      const mergeEndRow = merge.e.r + 1;
      // Check if this merge overlaps with our effective range
      if (mergeEndRow >= effectiveStart && mergeStartRow <= effectiveEnd) {
        const contextOnly = mergeStartRow > endRow || mergeEndRow < startRow;

        // Read the value from the top-left cell of the merge
        const addr = XLSX.utils.encode_cell({ r: merge.s.r, c: merge.s.c });
        const cell = ws[addr];
        const value = cell ? String(cell.v ?? '') : '';
        if (value.trim().length > 0) {
          const mergeDesc = `Merged ${XLSX.utils.encode_cell(merge.s)}:${XLSX.utils.encode_cell(merge.e)}`;
          result.annotations.push({
            unit: mergeStartRow,
            text: `${mergeDesc} = ${value}`,
            type: 'merged-cell',
            contextOnly,
          });
        }
      }
    }

    // Extract rows in the batch range (skip row 1 if already included as header)
    for (let row = effectiveStart; row <= effectiveEnd; row++) {
      // Header row is already included above
      if (row === 1) continue;

      const contextOnly = row < startRow || row > endRow;
      const cells: string[] = [];

      for (let c = decoded.s.c; c <= maxCol; c++) {
        const addr = XLSX.utils.encode_cell({ r: row - 1, c });
        const cell = ws[addr];
        cells.push(cell ? String(cell.v ?? '') : '');
      }

      const rowText = cells.join(',');
      if (rowText.trim().length > 0 && rowText.replace(/,/g, '').trim().length > 0) {
        result.textSegments.push({
          content: rowText,
          unit: row,
          contextOnly,
        });
      }

      // Check for bold/header-like formatting in the row
      let hasBoldCells = false;
      for (let c = decoded.s.c; c <= maxCol; c++) {
        const addr = XLSX.utils.encode_cell({ r: row - 1, c });
        const cell = ws[addr];
        if (cell && cell.s && typeof cell.s === 'object') {
          const style = cell.s satisfies Record<string, unknown>;
          const font = style['font'];
          if (font && typeof font === 'object') {
            const fontObj = font satisfies Record<string, unknown>;
            if (fontObj['bold'] === true) {
              hasBoldCells = true;
              break;
            }
          }
        }
      }

      if (hasBoldCells && rowText.replace(/,/g, '').trim().length > 0) {
        result.headings.push({
          title: cells.filter((c) => c.trim().length > 0).join(' | '),
          level: 2,
          unit: row,
        });
      }

      // Extract cell comments in the row
      for (let c = decoded.s.c; c <= maxCol; c++) {
        const addr = XLSX.utils.encode_cell({ r: row - 1, c });
        const cell = ws[addr];
        if (cell && cell.c && Array.isArray(cell.c)) {
          for (const comment of cell.c) {
            if (comment && typeof comment === 'object') {
              const commentObj = comment satisfies Record<string, unknown>;
              const commentText = typeof commentObj['t'] === 'string' ? commentObj['t'] : '';
              const commentAuthor = typeof commentObj['a'] === 'string' ? commentObj['a'] : '';
              if (commentText.trim().length > 0) {
                result.comments.push({
                  unit: row,
                  author: commentAuthor.length > 0 ? commentAuthor : undefined,
                  text: commentText.trim(),
                  referencedText: cell ? String(cell.v ?? '') : undefined,
                  contextOnly,
                });
              }
            }
          }
        }
      }
    }

    return result;
  }
}
