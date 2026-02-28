import { Injectable, Logger } from '@nestjs/common';

import JSZip from 'jszip';
import mammoth from 'mammoth';
import { lookup } from 'mime-types';

import type {
  BatchExtractionResult,
  ExtractionResult,
  PageText,
} from '../../../services/chunking/extractor.interface';

export interface DocxImage {
  buffer: Buffer;
  mimeType: string;
  page: number;
  surroundingText: string;
}

/**
 * Parsed paragraph from OOXML with metadata about its position and style.
 */
interface ParsedParagraph {
  index: number;
  text: string;
  styleRef: string;
  hasHighlight: boolean;
  highlightRuns: Array<{ text: string; color: string }>;
  footnoteRefs: string[];
  hasInsertions: boolean;
  hasDeletes: boolean;
  insertions: Array<{ text: string; author: string }>;
  deletions: Array<{ text: string; author: string }>;
  imageRelRefs: string[];
  commentRangeRefs: string[];
}

/**
 * Parsed comment from word/comments.xml.
 */
interface ParsedComment {
  id: string;
  author: string;
  text: string;
}

/**
 * Parsed footnote from word/footnotes.xml.
 */
interface ParsedFootnote {
  id: string;
  text: string;
}

const HEADING_PATTERN = /^Heading(\d)$/;

/**
 * Extract all text content from <w:t> elements within an XML fragment.
 */
function extractTextFromXml(xml: string): string {
  const parts: string[] = [];
  let i = 0;
  while (i < xml.length) {
    if (xml[i] === '<') {
      const tagEnd = xml.indexOf('>', i);
      if (tagEnd === -1) break;
      const tag = xml.slice(i, tagEnd + 1);
      if (/^<w:t[ >]/.test(tag)) {
        const closeIdx = xml.indexOf('</w:t>', tagEnd + 1);
        if (closeIdx !== -1) {
          parts.push(xml.slice(tagEnd + 1, closeIdx));
          i = closeIdx + 6;
          continue;
        }
      }
      i = tagEnd + 1;
    } else {
      i++;
    }
  }
  return parts.join('');
}

/**
 * Parse <w:p> elements from word/document.xml into structured paragraphs.
 */
function parseParagraphs(xml: string): ParsedParagraph[] {
  const paragraphs: ParsedParagraph[] = [];
  const pTagRegex = /<w:p[ >]/g;
  let match: RegExpExecArray | null = null;

  while ((match = pTagRegex.exec(xml)) !== null) {
    const pStart = match.index;
    const pEnd = xml.indexOf('</w:p>', pStart);
    if (pEnd === -1) continue;

    const pXml = xml.slice(pStart, pEnd + 6);

    // Extract paragraph style
    const styleMatch = pXml.match(/<w:pStyle\s+w:val="([^"]+)"/);
    const styleRef = styleMatch ? styleMatch[1] : '';

    // Extract text
    const text = extractTextFromXml(pXml);

    // Detect highlights: <w:highlight w:val="..."/>
    const highlightRuns: Array<{ text: string; color: string }> = [];
    let hasHighlight = false;
    const runRegex = /<w:r[ >][\s\S]*?<\/w:r>/g;
    let runMatch: RegExpExecArray | null = null;
    while ((runMatch = runRegex.exec(pXml)) !== null) {
      const runXml = runMatch[0];
      const hlMatch = runXml.match(/<w:highlight\s+w:val="([^"]+)"/);
      if (hlMatch) {
        hasHighlight = true;
        const runText = extractTextFromXml(runXml);
        if (runText.length > 0) {
          highlightRuns.push({ text: runText, color: hlMatch[1] });
        }
      }
    }

    // Detect footnote references: <w:footnoteReference w:id="..."/>
    const footnoteRefs: string[] = [];
    const fnRefRegex = /<w:footnoteReference\s+w:id="(\d+)"/g;
    let fnMatch: RegExpExecArray | null = null;
    while ((fnMatch = fnRefRegex.exec(pXml)) !== null) {
      footnoteRefs.push(fnMatch[1]);
    }

    // Detect track changes: <w:ins> and <w:del>
    const insertions: Array<{ text: string; author: string }> = [];
    const deletions: Array<{ text: string; author: string }> = [];
    const insRegex = /<w:ins\s+[^>]*w:author="([^"]*)"[^>]*>([\s\S]*?)<\/w:ins>/g;
    let insMatch: RegExpExecArray | null = null;
    while ((insMatch = insRegex.exec(pXml)) !== null) {
      const insText = extractTextFromXml(insMatch[2]);
      if (insText.length > 0) {
        insertions.push({ text: insText, author: insMatch[1] });
      }
    }
    const delRegex = /<w:del\s+[^>]*w:author="([^"]*)"[^>]*>([\s\S]*?)<\/w:del>/g;
    let delMatch: RegExpExecArray | null = null;
    while ((delMatch = delRegex.exec(pXml)) !== null) {
      // Deleted text is in <w:delText>
      const delTextRegex = /<w:delText[^>]*>([\s\S]*?)<\/w:delText>/g;
      let dtMatch: RegExpExecArray | null = null;
      const deletedParts: string[] = [];
      while ((dtMatch = delTextRegex.exec(delMatch[2])) !== null) {
        deletedParts.push(dtMatch[1]);
      }
      const delText = deletedParts.join('');
      if (delText.length > 0) {
        deletions.push({ text: delText, author: delMatch[1] });
      }
    }

    // Detect image references: <a:blip r:embed="..."/>
    const imageRelRefs: string[] = [];
    const blipRegex = /<a:blip\s+[^>]*r:embed="([^"]+)"/g;
    let blipMatch: RegExpExecArray | null = null;
    while ((blipMatch = blipRegex.exec(pXml)) !== null) {
      imageRelRefs.push(blipMatch[1]);
    }

    // Detect comment range starts
    const commentRangeRefs: string[] = [];
    const commentStartRegex = /<w:commentRangeStart\s+w:id="(\d+)"/g;
    let csMatch: RegExpExecArray | null = null;
    while ((csMatch = commentStartRegex.exec(pXml)) !== null) {
      commentRangeRefs.push(csMatch[1]);
    }

    paragraphs.push({
      index: paragraphs.length,
      text,
      styleRef,
      hasHighlight,
      highlightRuns,
      footnoteRefs,
      hasInsertions: insertions.length > 0,
      hasDeletes: deletions.length > 0,
      insertions,
      deletions,
      imageRelRefs,
      commentRangeRefs,
    });
  }

  return paragraphs;
}

/**
 * Parse word/comments.xml to extract comments keyed by ID.
 */
function parseComments(xml: string): Map<string, ParsedComment> {
  const comments = new Map<string, ParsedComment>();
  const commentRegex =
    /<w:comment\s+[^>]*w:id="(\d+)"[^>]*w:author="([^"]*)"[^>]*>([\s\S]*?)<\/w:comment>/g;
  let match: RegExpExecArray | null = null;
  while ((match = commentRegex.exec(xml)) !== null) {
    const text = extractTextFromXml(match[3]);
    comments.set(match[1], {
      id: match[1],
      author: match[2],
      text,
    });
  }
  return comments;
}

/**
 * Parse word/footnotes.xml to extract footnotes keyed by ID.
 * Skips the separator and continuation separator footnotes (ids 0 and 1).
 */
function parseFootnotes(xml: string): Map<string, ParsedFootnote> {
  const footnotes = new Map<string, ParsedFootnote>();
  const fnRegex = /<w:footnote\s+[^>]*w:id="(\d+)"[^>]*>([\s\S]*?)<\/w:footnote>/g;
  let match: RegExpExecArray | null = null;
  while ((match = fnRegex.exec(xml)) !== null) {
    const id = match[1];
    // Skip separator footnotes (id 0 and 1)
    if (id === '0' || id === '1') continue;
    const text = extractTextFromXml(match[2]);
    if (text.trim().length > 0) {
      footnotes.set(id, { id, text: text.trim() });
    }
  }
  return footnotes;
}

/**
 * Parse word/_rels/document.xml.rels to map relationship IDs to target paths.
 */
function parseRelationships(xml: string): Map<string, string> {
  const rels = new Map<string, string>();
  const relRegex = /<Relationship\s+[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
  let match: RegExpExecArray | null = null;
  while ((match = relRegex.exec(xml)) !== null) {
    rels.set(match[1], match[2]);
  }
  return rels;
}

/**
 * Parse word/document.xml to extract per-page text using Word's rendered page break markers.
 *
 * DOCX files contain two types of page break signals:
 * - `<w:lastRenderedPageBreak/>` - inserted by Word to mark where it rendered a page break
 * - `<w:br w:type="page"/>` - explicit hard page break inserted by the author
 *
 * We walk the XML character by character, tracking text in <w:t> elements and
 * splitting into pages at each break marker.
 */
function extractPagesFromXml(xml: string): PageText[] {
  const pages: PageText[] = [];
  let currentPageText = '';
  let currentPage = 1;

  // Simple state-machine XML parser: we only care about w:t content and page break elements
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
      if (/^<w:t[ >]/.test(tag)) {
        // Extract text content until </w:t>
        const closeIdx = xml.indexOf('</w:t>', tagEnd + 1);
        if (closeIdx !== -1) {
          currentPageText += xml.slice(tagEnd + 1, closeIdx);
          i = closeIdx + 6; // skip past </w:t>
          continue;
        }
      }

      // Check for paragraph end: add a newline to separate paragraphs
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

/**
 * Map paragraph indices to page numbers by walking document XML and
 * detecting page break markers between paragraphs.
 *
 * Uses the same `<w:lastRenderedPageBreak/>` and `<w:br w:type="page"/>`
 * markers as extractPagesFromXml, avoiding text-length heuristics.
 */
function buildParagraphPageMap(paragraphs: ParsedParagraph[], xml: string): Map<number, number> {
  const map = new Map<number, number>();
  if (paragraphs.length === 0) return map;

  // Walk the XML paragraphs, detecting page breaks to assign page numbers.
  // Page breaks (<w:lastRenderedPageBreak/> and <w:br w:type="page"/>)
  // are always inside <w:p> elements. A break inside a paragraph means
  // the content after it is on the next page.
  let currentPage = 1;
  let paraIdx = 0;
  const pTagRegex = /<w:p[ >]/g;

  let match: RegExpExecArray | null = null;
  while ((match = pTagRegex.exec(xml)) !== null) {
    const pStart = match.index;
    const pEnd = xml.indexOf('</w:p>', pStart);
    if (pEnd === -1) break;

    // Scan for page breaks FIRST within the paragraph XML
    const pXml = xml.slice(pStart, pEnd + 6);
    let scanPos = 0;
    while (scanPos < pXml.length) {
      const breakIdx1 = pXml.indexOf('lastRenderedPageBreak', scanPos);
      const breakIdx2 = pXml.indexOf('w:br', scanPos);

      if (breakIdx1 !== -1 && (breakIdx2 === -1 || breakIdx1 < breakIdx2)) {
        scanPos = breakIdx1 + 21;
        currentPage++;
      } else if (breakIdx2 !== -1) {
        // Verify it's a page break: check for type="page" nearby
        const brEnd = pXml.indexOf('>', breakIdx2);
        if (brEnd !== -1) {
          const brTag = pXml.slice(breakIdx2, brEnd + 1);
          if (brTag.includes('type="page"')) {
            currentPage++;
          }
        }
        scanPos = (brEnd !== -1 ? brEnd : breakIdx2) + 1;
      } else {
        break;
      }
    }

    // THEN assign paragraph to currentPage (which may have been incremented)
    if (paraIdx < paragraphs.length) {
      map.set(paraIdx, currentPage);
      paraIdx++;
    }
  }

  // Fill remaining paragraphs with the last page
  while (paraIdx < paragraphs.length) {
    map.set(paraIdx, currentPage);
    paraIdx++;
  }

  return map;
}

@Injectable()
export class DocxExtractor {
  private readonly logger = new Logger(DocxExtractor.name);

  async extract(buffer: Buffer): Promise<ExtractionResult> {
    // Try loading as a ZIP (DOCX format). Legacy .doc files are OLE2 binary, not ZIP.
    let zip: JSZip | null = null;
    try {
      zip = await JSZip.loadAsync(buffer);
    } catch {
      // Not a ZIP file, likely a legacy .doc binary format
    }

    // Try to extract per-page text from the document XML (DOCX only)
    let pages: PageText[] = [];
    if (zip) {
      const docXml = zip.file('word/document.xml');
      if (docXml) {
        const xml: string = await docXml.async('string');
        pages = extractPagesFromXml(xml);
      }
    }

    // Fallback: if XML parsing yielded nothing (or legacy .doc), use mammoth for plain text
    if (pages.length === 0) {
      const result = await mammoth.extractRawText({ buffer });
      const text: string = result.value;
      if (text.trim().length > 0) {
        pages = [{ page: 1, text: text.trim() + '\n' }];
      }
    }

    const fullText = pages.map((p) => p.text).join('');

    return { type: 'pages', text: fullText, pages };
  }

  /**
   * Extract embedded images from a DOCX file with their page context.
   * Returns image buffers, MIME types, page numbers, and surrounding text.
   */
  async extractImages(buffer: Buffer): Promise<DocxImage[]> {
    let zip: JSZip | null = null;
    try {
      zip = await JSZip.loadAsync(buffer);
    } catch {
      return []; // Legacy .doc format has no ZIP images
    }

    if (!zip) return [];

    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) return [];

    const xml: string = await docXmlFile.async('string');
    const paragraphs = parseParagraphs(xml);

    // Build a map from paragraph index to page number using XML page break markers
    const paraToPage = buildParagraphPageMap(paragraphs, xml);

    // Parse relationships for image resolution
    let relsMap = new Map<string, string>();
    const relsFile = zip.file('word/_rels/document.xml.rels');
    if (relsFile) {
      const relsXml: string = await relsFile.async('string');
      relsMap = parseRelationships(relsXml);
    }

    // Track unique image paths to avoid duplicates
    const seenPaths = new Set<string>();
    const images: DocxImage[] = [];

    for (const para of paragraphs) {
      if (para.imageRelRefs.length === 0) continue;

      const page = paraToPage.get(para.index) ?? 1;

      for (const relRef of para.imageRelRefs) {
        const target = relsMap.get(relRef);
        if (!target) continue;

        const imagePath = target.startsWith('/') ? target.slice(1) : `word/${target}`;
        if (seenPaths.has(imagePath)) continue;
        seenPaths.add(imagePath);

        const imageFile = zip.file(imagePath);
        if (!imageFile) continue;

        const imageBuffer = Buffer.from(await imageFile.async('uint8array'));

        // Skip very small images (icons, bullets, spacers)
        if (imageBuffer.length < 2000) continue;

        const ext = imagePath.split('.').pop() ?? '';
        const mimeType = lookup(ext) || 'image/png';

        // Only process actual image MIME types
        if (!mimeType.startsWith('image/')) continue;

        images.push({
          buffer: imageBuffer,
          mimeType,
          page,
          surroundingText: para.text.slice(0, 500),
        });
      }
    }

    return images;
  }

  /**
   * Extract rich content from a batch of DOCX paragraphs.
   *
   * @param buffer - The full DOCX file buffer
   * @param startPara - First paragraph of the primary range (0-based)
   * @param endPara - Last paragraph of the primary range (0-based, exclusive)
   * @param overlapBefore - Number of overlap paragraphs before startPara
   * @param overlapAfter - Number of overlap paragraphs after endPara
   */
  async extractBatch(
    buffer: Buffer,
    startPara: number,
    endPara: number,
    overlapBefore: number,
    overlapAfter: number
  ): Promise<BatchExtractionResult> {
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

    let zip: JSZip | null = null;
    try {
      zip = await JSZip.loadAsync(buffer);
    } catch {
      // Legacy .doc, fall back to mammoth plain text
      const mammothResult = await mammoth.extractRawText({ buffer });
      const text: string = mammothResult.value;
      if (text.trim().length > 0) {
        result.textSegments.push({
          content: text.trim(),
          unit: 0,
          contextOnly: false,
        });
      }
      return result;
    }

    if (!zip) return result;

    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) return result;

    const xml: string = await docXmlFile.async('string');
    const paragraphs = parseParagraphs(xml);

    const effectiveStart = Math.max(0, startPara - overlapBefore);
    const effectiveEnd = Math.min(paragraphs.length, endPara + overlapAfter);

    // Parse comments if available
    let commentsMap = new Map<string, ParsedComment>();
    const commentsFile = zip.file('word/comments.xml');
    if (commentsFile) {
      const commentsXml: string = await commentsFile.async('string');
      commentsMap = parseComments(commentsXml);
    }

    // Parse footnotes if available
    let footnotesMap = new Map<string, ParsedFootnote>();
    const footnotesFile = zip.file('word/footnotes.xml');
    if (footnotesFile) {
      const footnotesXml: string = await footnotesFile.async('string');
      footnotesMap = parseFootnotes(footnotesXml);
    }

    // Parse relationships for image resolution
    let relsMap = new Map<string, string>();
    const relsFile = zip.file('word/_rels/document.xml.rels');
    if (relsFile) {
      const relsXml: string = await relsFile.async('string');
      relsMap = parseRelationships(relsXml);
    }

    for (let i = effectiveStart; i < effectiveEnd; i++) {
      const para = paragraphs[i];
      if (!para) continue;

      const contextOnly = i < startPara || i >= endPara;
      const unit = i;

      // Text segments
      if (para.text.trim().length > 0) {
        result.textSegments.push({
          content: para.text,
          unit,
          contextOnly,
        });
      }

      // Headings
      const headingMatch = HEADING_PATTERN.exec(para.styleRef);
      if (headingMatch && para.text.trim().length > 0) {
        result.headings.push({
          title: para.text.trim(),
          level: parseInt(headingMatch[1], 10),
          unit,
        });
      }

      // Highlights
      for (const hl of para.highlightRuns) {
        result.highlights.push({
          unit,
          text: hl.text,
          color: hl.color,
          contextOnly,
        });
      }

      // Comments referenced by this paragraph
      for (const commentRef of para.commentRangeRefs) {
        const comment = commentsMap.get(commentRef);
        if (comment && comment.text.trim().length > 0) {
          result.comments.push({
            unit,
            author: comment.author.length > 0 ? comment.author : undefined,
            text: comment.text.trim(),
            referencedText: para.text.trim().length > 0 ? para.text.trim() : undefined,
            contextOnly,
          });
        }
      }

      // Footnotes referenced by this paragraph
      for (const fnId of para.footnoteRefs) {
        const footnote = footnotesMap.get(fnId);
        if (footnote) {
          result.footnotes.push({
            text: footnote.text,
            unit,
            contextOnly,
          });
        }
      }

      // Track changes
      for (const ins of para.insertions) {
        result.trackChanges.push({
          type: 'insert',
          author: ins.author.length > 0 ? ins.author : undefined,
          text: ins.text,
          contextOnly,
        });
      }
      for (const del of para.deletions) {
        result.trackChanges.push({
          type: 'delete',
          author: del.author.length > 0 ? del.author : undefined,
          text: del.text,
          contextOnly,
        });
      }

      // Images: resolve relationship IDs to file paths and extract buffers
      for (const relRef of para.imageRelRefs) {
        const target = relsMap.get(relRef);
        if (!target) continue;

        const imagePath = target.startsWith('/') ? target.slice(1) : `word/${target}`;
        const imageFile = zip.file(imagePath);
        if (!imageFile) continue;

        const imageBuffer = Buffer.from(await imageFile.async('uint8array'));
        if (imageBuffer.length < 2000) continue; // Skip tiny images

        const ext = imagePath.split('.').pop() ?? '';
        const imgMimeType = lookup(ext) || 'image/png';
        if (!imgMimeType.startsWith('image/')) continue;

        result.images.push({
          unit,
          s3Key: '',
          buffer: imageBuffer,
          mimeType: imgMimeType,
          surroundingText: para.text.slice(0, 500),
          contextOnly,
        });
      }
    }

    return result;
  }
}
