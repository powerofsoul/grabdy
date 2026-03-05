import type { ChunkMeta, DocumentClassification } from '@grabdy/contracts';

import {
  CHUNK_OVERLAP_TOKENS,
  CHUNK_SIZE_TOKENS,
  MIN_CHUNK_SIZE_TOKENS,
} from '../../../../config/constants';
import type { ChunkWithMeta, SyncedMessageData } from '../../data-source.types';

import type {
  BatchExtractionResult,
  EmailExtractionResult,
  PageText,
  SheetData,
  SheetRow,
} from './extractor.interface';
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
 * Group consecutive messages into conversation-window chunks up to CHUNK_SIZE_TOKENS.
 * Messages with the same metadata context are grouped together.
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
    const contextChanged = JSON.stringify(chunkMeta) !== JSON.stringify(msg.metadata);
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
      // Append undersized tail to the last chunk
      const last = chunks[chunks.length - 1];
      chunks[chunks.length - 1] = {
        ...last,
        content: last.content + '\n' + buffer,
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

/**
 * Per-page chunking for the new PDF pipeline.
 * Each page is chunked independently. Undersized pages are merged
 * with the previous page's last chunk.
 */
export function chunkPerPage(pages: PageText[], source: ChunkSource): ChunkWithMeta[] {
  const chunks: ChunkWithMeta[] = [];

  for (const page of pages) {
    const trimmed = page.text.trim();
    if (!trimmed) continue;

    const tokens = countTokens(trimmed);

    // Undersized page: merge with previous chunk if available
    if (tokens < MIN_CHUNK_SIZE_TOKENS && chunks.length > 0) {
      const last = chunks[chunks.length - 1];
      const combined = last.content + '\n\n' + trimmed;
      if (countTokens(combined) <= CHUNK_SIZE_TOKENS * 2) {
        // Add this page to the previous chunk's pages list
        const prevPages = last.metadata.type === 'PDF' ? last.metadata.pages : [];
        chunks[chunks.length - 1] = {
          ...last,
          content: combined,
          metadata: { type: 'PDF', pages: [...prevPages, page.page] },
        };
        continue;
      }
    }

    if (tokens <= CHUNK_SIZE_TOKENS) {
      // Single chunk for this page
      chunks.push({
        content: trimmed,
        metadata: { type: 'PDF', pages: [page.page] },
        ...source,
      });
    } else {
      // Page exceeds chunk size, split it
      const segments = splitText(trimmed, {
        maxSizeTokens: CHUNK_SIZE_TOKENS,
        overlapTokens: CHUNK_OVERLAP_TOKENS,
        minSizeTokens: MIN_CHUNK_SIZE_TOKENS,
      });
      for (const seg of segments) {
        chunks.push({
          content: seg,
          metadata: { type: 'PDF', pages: [page.page] },
          ...source,
        });
      }
    }
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

/**
 * Split an email body into chunks, preserving quoted reply chains with their context.
 * Each chunk is prefixed with email headers so the embedding captures the email context.
 */
export function chunkEmail(email: EmailExtractionResult, source: ChunkSource): ChunkWithMeta[] {
  const { headers, bodyText } = email;

  const metadata: Extract<ChunkMeta, { type: 'EMAIL' }> = {
    type: 'EMAIL',
    emailFrom: headers.from,
    emailTo: headers.to,
    emailSubject: headers.subject,
    emailDate: headers.date,
    emailRfcMessageRef: headers.rfcMessageRef,
  };

  // Build a header prefix that gets prepended to every chunk for context
  const headerLines: string[] = [];
  if (headers.from) headerLines.push(`From: ${headers.from}`);
  if (headers.to.length > 0) headerLines.push(`To: ${headers.to.join(', ')}`);
  if (headers.subject) headerLines.push(`Subject: ${headers.subject}`);
  if (headers.date) headerLines.push(`Date: ${headers.date}`);
  const headerPrefix = headerLines.length > 0 ? headerLines.join('\n') + '\n\n' : '';

  if (!bodyText.trim()) {
    return [{ content: headerPrefix.trim(), metadata, ...source }];
  }

  // Separate the main body from quoted reply sections.
  // Quoted lines start with ">" or common reply markers like "On ... wrote:".
  const lines = bodyText.split('\n');
  const sections: Array<{ text: string; isQuote: boolean }> = [];
  let currentLines: string[] = [];
  let currentIsQuote = false;

  for (const line of lines) {
    const isQuotedLine = line.startsWith('>') || line.startsWith('&gt;');
    if (currentLines.length > 0 && isQuotedLine !== currentIsQuote) {
      sections.push({ text: currentLines.join('\n'), isQuote: currentIsQuote });
      currentLines = [];
    }
    currentIsQuote = isQuotedLine;
    currentLines.push(line);
  }
  if (currentLines.length > 0) {
    sections.push({ text: currentLines.join('\n'), isQuote: currentIsQuote });
  }

  // Try to keep each reply section together with its preceding context.
  // Merge quote sections with their "On ... wrote:" introduction line.
  const mergedBlocks: string[] = [];
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (section.isQuote && mergedBlocks.length > 0) {
      // Check if last block ends with a reply intro line (e.g., "On Mon, Jan 1, ... wrote:")
      const lastBlock = mergedBlocks[mergedBlocks.length - 1];
      const lastLine = lastBlock.trimEnd().split('\n').pop() ?? '';
      if (/wrote:\s*$/.test(lastLine)) {
        mergedBlocks[mergedBlocks.length - 1] = lastBlock + '\n' + section.text;
        continue;
      }
    }
    mergedBlocks.push(section.text);
  }

  // Now chunk each block using the text splitter, prepending headers to each chunk
  const headerTokens = countTokens(headerPrefix);
  const availableTokens = CHUNK_SIZE_TOKENS - headerTokens;

  const chunks: ChunkWithMeta[] = [];
  for (const block of mergedBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (availableTokens <= MIN_CHUNK_SIZE_TOKENS) {
      // Header is very large, just do plain splits
      const segments = splitText(headerPrefix + trimmed, {
        maxSizeTokens: CHUNK_SIZE_TOKENS,
        overlapTokens: CHUNK_OVERLAP_TOKENS,
        minSizeTokens: MIN_CHUNK_SIZE_TOKENS,
      });
      for (const seg of segments) {
        chunks.push({ content: seg, metadata, ...source });
      }
    } else {
      const segments = splitText(trimmed, {
        maxSizeTokens: availableTokens,
        overlapTokens: CHUNK_OVERLAP_TOKENS,
        minSizeTokens: Math.min(MIN_CHUNK_SIZE_TOKENS, availableTokens),
      });
      for (const seg of segments) {
        chunks.push({ content: headerPrefix + seg, metadata, ...source });
      }
    }
  }

  // If no chunks were produced (empty body after trimming), return header-only chunk
  if (chunks.length === 0) {
    chunks.push({ content: headerPrefix.trim(), metadata, ...source });
  }

  return chunks;
}

// ── Context-aware chunking ──────────────────────────────────────────

/**
 * Build a context header that gets prepended to each chunk's content
 * so the embedding captures document-level context.
 */
export function buildEmbeddingContext(params: {
  filename?: string;
  classification: DocumentClassification | null;
  headings: Array<{ title: string; level: number; unit: number }>;
  unit: number;
}): string {
  const lines: string[] = [];

  const docLabel = params.classification?.documentCategory ?? 'document';
  if (params.filename) {
    lines.push(`Document: ${params.filename} (${docLabel})`);
  } else {
    lines.push(`Document: ${docLabel}`);
  }

  // Build heading hierarchy for the given unit: find the most recent heading
  // at each level that appears at or before this unit.
  const activeHeadings: Array<{ title: string; level: number }> = [];
  for (const h of params.headings) {
    if (h.unit > params.unit) break;
    // Remove any headings at the same or deeper level (they are superseded)
    while (
      activeHeadings.length > 0 &&
      activeHeadings[activeHeadings.length - 1].level >= h.level
    ) {
      activeHeadings.pop();
    }
    activeHeadings.push({ title: h.title, level: h.level });
  }

  if (activeHeadings.length > 0) {
    lines.push(`Section: ${activeHeadings.map((h) => h.title).join(' > ')}`);
  }

  lines.push(`Page: ${params.unit}`);
  lines.push('---');

  return lines.join('\n') + '\n';
}

/**
 * Group text segments by heading boundaries, splitting oversized sections
 * with the recursive text splitter. Each chunk gets a heading hierarchy prefix.
 *
 * Only processes non-contextOnly segments. contextOnly segments are ignored
 * (they serve as boundary context for extractors, not standalone content).
 */
export function chunkByHeadings(
  textSegments: BatchExtractionResult['textSegments'],
  headings: BatchExtractionResult['headings']
): ChunkWithMeta[] {
  const contentSegments = textSegments.filter((s) => !s.contextOnly);
  if (contentSegments.length === 0) return [];

  // Build a sorted list of heading boundary units
  const headingUnits = new Set(headings.map((h) => h.unit));

  // Group segments into sections by heading boundaries
  const sections: Array<{ startUnit: number; text: string }> = [];
  let currentText = '';
  let sectionStartUnit = contentSegments[0].unit;

  for (const seg of contentSegments) {
    // If this segment starts a new heading boundary, flush the current section
    if (headingUnits.has(seg.unit) && currentText.length > 0) {
      sections.push({ startUnit: sectionStartUnit, text: currentText });
      currentText = '';
      sectionStartUnit = seg.unit;
    }
    currentText += (currentText.length > 0 ? '\n\n' : '') + seg.content;
  }
  if (currentText.length > 0) {
    sections.push({ startUnit: sectionStartUnit, text: currentText });
  }

  // Build heading hierarchy prefix for a given unit
  function getHeadingPrefix(unit: number): string {
    const active: Array<{ title: string; level: number }> = [];
    for (const h of headings) {
      if (h.unit > unit) break;
      while (active.length > 0 && active[active.length - 1].level >= h.level) {
        active.pop();
      }
      active.push({ title: h.title, level: h.level });
    }
    if (active.length === 0) return '';
    return active.map((h) => h.title).join(' > ') + '\n\n';
  }

  // Chunk each section, prepending the heading hierarchy
  const chunks: ChunkWithMeta[] = [];

  for (const section of sections) {
    const prefix = getHeadingPrefix(section.startUnit);
    const prefixTokens = countTokens(prefix);
    const availableTokens = CHUNK_SIZE_TOKENS - prefixTokens;

    if (availableTokens <= MIN_CHUNK_SIZE_TOKENS) {
      // Prefix is very large, just split the combined text
      const segments = splitText(prefix + section.text, {
        maxSizeTokens: CHUNK_SIZE_TOKENS,
        overlapTokens: CHUNK_OVERLAP_TOKENS,
        minSizeTokens: MIN_CHUNK_SIZE_TOKENS,
      });
      for (const seg of segments) {
        chunks.push({
          content: seg,
          metadata: { type: 'PDF', pages: [section.startUnit] },
          sourceUrl: null,
          sourceKey: null,
        });
      }
    } else {
      const segments = splitText(section.text, {
        maxSizeTokens: availableTokens,
        overlapTokens: CHUNK_OVERLAP_TOKENS,
        minSizeTokens: Math.min(MIN_CHUNK_SIZE_TOKENS, availableTokens),
      });
      for (const seg of segments) {
        chunks.push({
          content: prefix + seg,
          metadata: { type: 'PDF', pages: [section.startUnit] },
          sourceUrl: null,
          sourceKey: null,
        });
      }
    }
  }

  return chunks;
}

/**
 * Main dispatcher that selects a chunking strategy based on document classification,
 * then weaves in rich elements (highlights, comments, form fields, etc.).
 */
export function chunkBatch(params: {
  extraction: BatchExtractionResult;
  enrichments: Array<{ page?: number; description: string }> | null;
  classification: DocumentClassification | null;
  batchRange: { start: number; end: number };
  filename?: string;
  source?: ChunkSource;
}): ChunkWithMeta[] {
  const { extraction, enrichments, classification, batchRange, filename } = params;
  const source: ChunkSource = params.source ?? { sourceUrl: null, sourceKey: null };
  const strategy = classification?.chunkingStrategy ?? 'default_recursive';

  // ── Step 1: Strategy-based text chunking ────────────────────────

  let chunks: ChunkWithMeta[];

  switch (strategy) {
    case 'heading_aware': {
      chunks = chunkByHeadings(extraction.textSegments, extraction.headings);
      // Update source on all chunks
      for (let i = 0; i < chunks.length; i++) {
        chunks[i] = { ...chunks[i], ...source };
      }
      break;
    }

    case 'table_aware': {
      // Keep rows together with column headers using spreadsheet-style chunking.
      const contentSegments = extraction.textSegments.filter((s) => !s.contextOnly);
      const fullText = contentSegments.map((s) => s.content).join('\n\n');
      chunks = chunkPlainText(fullText, { type: 'PDF', pages: [batchRange.start] }, source);
      break;
    }

    case 'email_thread': {
      // Build a synthetic EmailExtractionResult from the text segments
      const contentSegments = extraction.textSegments.filter((s) => !s.contextOnly);
      const bodyText = contentSegments.map((s) => s.content).join('\n\n');
      const emailResult: EmailExtractionResult = {
        headers: {
          from: '',
          to: [],
          subject: '',
          date: '',
          rfcMessageRef: null,
        },
        bodyText,
        attachments: [],
      };
      chunks = chunkEmail(emailResult, source);
      break;
    }

    case 'spreadsheet_row': {
      // One chunk per row group, with column context from headings
      const contentSegments = extraction.textSegments.filter((s) => !s.contextOnly);
      const columnHeaders =
        extraction.headings.length > 0 ? extraction.headings.map((h) => h.title) : [];
      const columnContext =
        columnHeaders.length > 0 ? `Columns: ${columnHeaders.join(', ')}\n\n` : '';
      const rows: SheetRow[] = contentSegments.map((seg) => ({
        row: seg.unit,
        text: columnContext + seg.content,
      }));
      chunks = chunkCsv(rows, columnHeaders, source);
      break;
    }

    case 'default_recursive':
    default: {
      const contentSegments = extraction.textSegments.filter((s) => !s.contextOnly);
      // Use page-aware chunking to preserve per-page metadata
      const pages: PageText[] = contentSegments
        .filter((s) => s.content.trim().length > 0)
        .map((s) => ({ page: s.unit, text: s.content }));
      if (pages.length > 0) {
        chunks = chunkPages(pages, 'PDF', source);
      } else {
        chunks = [];
      }
      break;
    }
  }

  // ── Step 2: Weave in rich elements ──────────────────────────────

  // Highlights -> chunk with prefix + surrounding context
  for (const highlight of extraction.highlights) {
    if (highlight.contextOnly) continue;
    const content = `Highlighted text: ${highlight.text}`;
    if (countTokens(content) >= MIN_CHUNK_SIZE_TOKENS) {
      chunks.push({
        content,
        metadata: { type: 'PDF', pages: [highlight.unit] },
        ...source,
      });
    } else {
      appendToNearestChunk(chunks, content, highlight.unit);
    }
  }

  // Comments -> "Comment by {author}: {comment}" + referenced text
  for (const comment of extraction.comments) {
    if (comment.contextOnly) continue;
    const authorPart = comment.author ? `Comment by ${comment.author}` : 'Comment';
    const refPart = comment.referencedText ? ` on "${comment.referencedText}"` : '';
    const content = `${authorPart}${refPart}: ${comment.text}`;
    if (countTokens(content) >= MIN_CHUNK_SIZE_TOKENS) {
      chunks.push({
        content,
        metadata: { type: 'PDF', pages: [comment.unit] },
        ...source,
      });
    } else {
      appendToNearestChunk(chunks, content, comment.unit);
    }
  }

  // Form fields -> group all fields into one chunk
  if (extraction.formFields.length > 0) {
    const fieldLines = extraction.formFields.map((f) => `${f.name}: ${f.value}`);
    const content = `Form data:\n${fieldLines.join('\n')}`;
    chunks.push({
      content,
      metadata: { type: 'PDF', pages: [extraction.formFields[0].unit] },
      ...source,
    });
  }

  // Footnotes -> appended to nearest text chunk
  for (const footnote of extraction.footnotes) {
    if (footnote.contextOnly) continue;
    appendToNearestChunk(chunks, `Footnote: ${footnote.text}`, footnote.unit);
  }

  // Track changes -> "Change by {author}: deleted '{old}', added '{new}'"
  for (const change of extraction.trackChanges) {
    if (change.contextOnly) continue;
    const authorPart = change.author ? `Change by ${change.author}` : 'Change';
    const content =
      change.type === 'delete'
        ? `${authorPart}: deleted "${change.text}"`
        : `${authorPart}: added "${change.text}"`;
    appendToNearestChunk(chunks, content, 0);
  }

  // Images -> enrichment description becomes a chunk
  if (enrichments) {
    for (const enrichment of enrichments) {
      const pageNum = enrichment.page ?? batchRange.start;
      const content = enrichment.description;
      if (countTokens(content) >= MIN_CHUNK_SIZE_TOKENS) {
        chunks.push({
          content,
          metadata: { type: 'PDF', pages: [pageNum] },
          ...source,
        });
      } else if (content.trim().length > 0) {
        appendToNearestChunk(chunks, content, pageNum);
      }
    }
  }

  // ── Step 3: Set embedding context on all chunks (stored separately, not in content) ──

  if (filename || classification) {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const pages =
        chunk.metadata.type === 'PDF' || chunk.metadata.type === 'DOCX' ? chunk.metadata.pages : [];
      const unit = pages.length > 0 ? pages[0] : batchRange.start;
      const ctx = buildEmbeddingContext({
        filename,
        classification,
        headings: extraction.headings,
        unit,
      });
      chunks[i] = { ...chunk, embeddingContext: ctx };
    }
  }

  return chunks;
}

/**
 * Append content to the nearest existing chunk by unit number.
 * If no chunks exist, creates a new standalone chunk.
 * If appending would more than double the token limit, creates a standalone chunk.
 */
function appendToNearestChunk(chunks: ChunkWithMeta[], content: string, unit: number): void {
  if (chunks.length === 0) {
    chunks.push({
      content,
      metadata: { type: 'PDF', pages: [unit] },
      sourceUrl: null,
      sourceKey: null,
    });
    return;
  }

  // Find the chunk whose unit (first page) is closest to the target unit
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < chunks.length; i++) {
    const meta = chunks[i].metadata;
    const chunkUnit = meta.type === 'PDF' || meta.type === 'DOCX' ? (meta.pages[0] ?? 0) : 0;
    const dist = Math.abs(chunkUnit - unit);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  const target = chunks[bestIdx];
  const combined = target.content + '\n' + content;

  // Only append if it doesn't blow past the token limit too much (2x allowed)
  if (countTokens(combined) <= CHUNK_SIZE_TOKENS * 2) {
    chunks[bestIdx] = { ...target, content: combined };
  } else {
    // Create a standalone chunk instead
    chunks.push({
      content,
      metadata: { type: 'PDF', pages: [unit] },
      sourceUrl: null,
      sourceKey: null,
    });
  }
}
