import type { ChunkMeta } from '@grabdy/contracts';

import {
  CHUNK_OVERLAP_TOKENS,
  CHUNK_SIZE_TOKENS,
  MIN_CHUNK_SIZE_TOKENS,
} from '../../../../config/constants';
import type { ChunkWithMeta, SyncedMessageData } from '../../data-source.types';

import type { PageText, SheetData, SheetRow } from './extractor.interface';
import { splitText } from './recursive-text-splitter';
import { countTokens, decodeTokens, encodeTokens } from './tokenizer';

export interface ChunkSource {
  sourceUrl: string | null;
  sourceKey: string | null;
}

export function chunkPlainText(
  text: string,
  metadata: ChunkMeta,
  source: ChunkSource
): ChunkWithMeta[] {
  const segments = splitText(text, {
    maxSizeTokens: CHUNK_SIZE_TOKENS,
    overlapTokens: CHUNK_OVERLAP_TOKENS,
    minSizeTokens: MIN_CHUNK_SIZE_TOKENS,
  });
  return segments.map((content) => ({ content, metadata, ...source }));
}

/**
 * Check if two ChunkMeta objects represent the same grouping context.
 * Messages with the same context can be grouped into a single chunk.
 * For Slack, messages from the same channel are grouped regardless of author
 * — all unique authors are collected into the chunk's `slackAuthors` array.
 */
function isSameGroupingContext(a: ChunkMeta, b: ChunkMeta): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'SLACK' && b.type === 'SLACK') {
    return a.slackChannelId === b.slackChannelId;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Merge authors from a message into a SLACK chunk's metadata.
 * Collects unique authors across all grouped messages.
 */
function mergeSlackAuthors(chunkMeta: ChunkMeta, messageMeta: ChunkMeta): ChunkMeta {
  if (chunkMeta.type !== 'SLACK' || messageMeta.type !== 'SLACK') return chunkMeta;
  const existing = new Set(chunkMeta.slackAuthors);
  for (const author of messageMeta.slackAuthors) {
    existing.add(author);
  }
  return { ...chunkMeta, slackAuthors: [...existing] };
}

/**
 * Group consecutive messages into conversation-window chunks up to CHUNK_SIZE_TOKENS.
 * Messages from the same context (e.g., same Slack channel) are grouped together,
 * collecting all unique authors into the chunk's metadata.
 * Oversized individual messages are split using the recursive text splitter.
 */
export function groupMessages(msgs: SyncedMessageData[]): ChunkWithMeta[] {
  if (msgs.length === 0) return [];

  const chunks: ChunkWithMeta[] = [];
  let buffer = '';
  let bufferTokens = 0;
  let chunkMeta: ChunkMeta = msgs[0].metadata;
  let anchorUrl: string = msgs[0].sourceUrl;

  for (const msg of msgs) {
    const contextChanged = !isSameGroupingContext(chunkMeta, msg.metadata);
    const separator = buffer.length > 0 ? '\n' : '';
    const candidateTokens = countTokens(separator + msg.content);

    if (
      (bufferTokens + candidateTokens > CHUNK_SIZE_TOKENS || contextChanged) &&
      buffer.length > 0
    ) {
      // Flush current buffer as a chunk
      chunks.push({ content: buffer, metadata: chunkMeta, sourceUrl: anchorUrl, sourceKey: null });
      buffer = '';
      bufferTokens = 0;
      chunkMeta = msg.metadata;
      anchorUrl = msg.sourceUrl;
    } else {
      // Merge authors from this message into the chunk metadata
      chunkMeta = mergeSlackAuthors(chunkMeta, msg.metadata);
    }

    buffer += separator + msg.content;
    bufferTokens = countTokens(buffer);

    // If a single message exceeds CHUNK_SIZE_TOKENS, flush and split it
    if (bufferTokens > CHUNK_SIZE_TOKENS) {
      chunks.push(...chunkPlainText(buffer, chunkMeta, { sourceUrl: anchorUrl, sourceKey: null }));
      buffer = '';
      bufferTokens = 0;
      chunkMeta = msg.metadata;
      anchorUrl = msg.sourceUrl;
    }
  }

  if (buffer.length > 0) {
    if (bufferTokens >= MIN_CHUNK_SIZE_TOKENS) {
      chunks.push({ content: buffer, metadata: chunkMeta, sourceUrl: anchorUrl, sourceKey: null });
    } else if (chunks.length > 0) {
      // Append undersized tail to the last chunk and merge authors
      const last = chunks[chunks.length - 1];
      chunks[chunks.length - 1] = {
        ...last,
        content: last.content + '\n' + buffer,
        metadata: mergeSlackAuthors(last.metadata, chunkMeta),
      };
    } else {
      // Only chunk — keep it regardless of size
      chunks.push({ content: buffer, metadata: chunkMeta, sourceUrl: anchorUrl, sourceKey: null });
    }
  }

  return chunks;
}

export function chunkPages(
  pages: PageText[],
  metaType: 'PDF' | 'DOCX',
  source: ChunkSource
): ChunkWithMeta[] {
  // Build a flat string with page boundary tracking
  const boundaries: Array<{ offset: number; page: number }> = [];
  let fullText = '';

  for (const p of pages) {
    boundaries.push({ offset: fullText.length, page: p.page });
    fullText += p.text;
  }

  // Split WITHOUT overlap first so we can accurately track positions
  const baseSegments = splitText(fullText, {
    maxSizeTokens: CHUNK_SIZE_TOKENS,
    overlapTokens: 0,
    minSizeTokens: MIN_CHUNK_SIZE_TOKENS,
  });

  // Segments are contiguous (no overlap) — track offset cumulatively
  const chunks: ChunkWithMeta[] = [];
  let offset = 0;

  for (let i = 0; i < baseSegments.length; i++) {
    const base = baseSegments[i];
    const start = offset;
    const end = start + base.length;

    // Apply overlap: prepend tail of previous segment (token-aware)
    let content = base;
    let overlapLen = 0;
    if (i > 0 && CHUNK_OVERLAP_TOKENS > 0) {
      const prev = baseSegments[i - 1];
      const prevTokens = encodeTokens(prev);
      const overlapStart = Math.max(0, prevTokens.length - CHUNK_OVERLAP_TOKENS);
      const overlapText = decodeTokens(prevTokens.slice(overlapStart));
      content = overlapText + base;
      overlapLen = overlapText.length;
    }

    // Find which pages this chunk spans (including the overlap region)
    const contentStart = start - overlapLen;
    const pageSet = new Set<number>();
    for (const b of boundaries) {
      const pageIdx = b.page - 1;
      const pageLen = pages[pageIdx]?.text.length ?? 0;
      const pageStart = b.offset;
      const pageEnd = pageStart + pageLen;
      if (pageStart < end && pageEnd > contentStart) {
        pageSet.add(b.page);
      }
    }

    const pageNums = [...pageSet].sort((a, b) => a - b);
    chunks.push({
      content,
      metadata: { type: metaType, pages: pageNums },
      ...source,
    });

    offset = end;
  }

  return chunks;
}

export function chunkSheets(sheets: SheetData[], source: ChunkSource): ChunkWithMeta[] {
  const chunks: ChunkWithMeta[] = [];
  for (const sheet of sheets) {
    let buffer = '';
    let bufferTokens = 0;
    let startRow = sheet.rows[0]?.row ?? 1;
    for (const row of sheet.rows) {
      const rowTokens = countTokens(row.text);
      if (bufferTokens + rowTokens > CHUNK_SIZE_TOKENS && buffer.length > 0) {
        chunks.push({
          content: buffer,
          metadata: { type: 'XLSX', sheet: sheet.sheet, row: startRow, columns: sheet.columns },
          ...source,
        });
        buffer = '';
        bufferTokens = 0;
        startRow = row.row;
      }
      buffer += (buffer.length > 0 ? '\n' : '') + row.text;
      bufferTokens += rowTokens + (bufferTokens > 0 ? 1 : 0); // +1 for newline token
    }
    if (buffer.length > 0) {
      chunks.push({
        content: buffer,
        metadata: { type: 'XLSX', sheet: sheet.sheet, row: startRow, columns: sheet.columns },
        ...source,
      });
    }
  }
  return chunks;
}

export function chunkCsv(
  rows: SheetRow[],
  columns: string[],
  source: ChunkSource
): ChunkWithMeta[] {
  const chunks: ChunkWithMeta[] = [];
  let buffer = '';
  let bufferTokens = 0;
  let startRow = rows[0]?.row ?? 1;
  for (const row of rows) {
    const rowTokens = countTokens(row.text);
    if (bufferTokens + rowTokens > CHUNK_SIZE_TOKENS && buffer.length > 0) {
      chunks.push({
        content: buffer,
        metadata: { type: 'CSV', row: startRow, columns },
        ...source,
      });
      buffer = '';
      bufferTokens = 0;
      startRow = row.row;
    }
    buffer += (buffer.length > 0 ? '\n' : '') + row.text;
    bufferTokens += rowTokens + (bufferTokens > 0 ? 1 : 0);
  }
  if (buffer.length > 0) {
    chunks.push({
      content: buffer,
      metadata: { type: 'CSV', row: startRow, columns },
      ...source,
    });
  }
  return chunks;
}
