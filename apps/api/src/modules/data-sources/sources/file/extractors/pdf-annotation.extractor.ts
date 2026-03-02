import { Injectable, Logger } from '@nestjs/common';

import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFStream,
  PDFString,
} from 'pdf-lib';

import {
  VECTOR_FIG_MAX_RAW_PATHS,
  VECTOR_FIG_MAX_TEXT_COVERAGE,
  VECTOR_FIG_MERGE_DISTANCE_PTS,
  VECTOR_FIG_MIN_HEIGHT_PTS,
  VECTOR_FIG_MIN_PATHS,
  VECTOR_FIG_MIN_WIDTH_PTS,
  VECTOR_FIG_PADDING_PTS,
  VECTOR_FIG_RENDER_DPI,
} from '../../../../../config/constants';

/** Max decoded stream size: 10 MB (content streams are typically a few KB) */
const MAX_DECODED_STREAM_BYTES = 10 * 1024 * 1024;

/**
 * Decode a PDFRawStream and return its uncompressed bytes.
 * pdf-lib's decodePDFRawStream returns different internal stream types
 * depending on the filter: FlateStream (FlateDecode), ASCIIHexStream, etc.
 * These expose decoded data via getBytes(length) method or a bytes property.
 */
function getDecodedStreamBytes(stream: PDFRawStream): Uint8Array {
  const decoded = decodePDFRawStream(stream);
  // FlateStream and other decode streams expose getBytes(length)
  if (decoded && 'getBytes' in decoded && typeof decoded.getBytes === 'function') {
    const result: unknown = decoded.getBytes(MAX_DECODED_STREAM_BYTES);
    if (result instanceof Uint8Array) return result;
  }
  // Some stream types expose a bytes property directly
  if (decoded && 'bytes' in decoded) {
    const b = decoded.bytes;
    if (b instanceof Uint8Array) return b;
  }
  return new Uint8Array(0);
}

import type {
  BatchExtractionResult,
  PageText,
} from '../../../services/chunking/extractor.interface';

const execFileAsync = promisify(execFile);

// ── Types ───────────────────────────────────────────────────────────

export interface HighlightAnnotation {
  quadPoints: number[][];
  color?: string;
  contents?: string;
}

export interface CommentAnnotation {
  author?: string;
  text: string;
  rect: number[];
}

export interface FormFieldEntry {
  name: string;
  value: string;
  rect?: number[];
}

export interface PositionedTag {
  tag: string;
  /** Y position in pdftotext-bbox coords (top-left origin). undefined = append at end */
  yPosition: number | undefined;
}

export interface PageAnnotations {
  highlights: HighlightAnnotation[];
  comments: CommentAnnotation[];
  formFields: FormFieldEntry[];
}

export interface WordPosition {
  text: string;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

interface OutlineEntry {
  title: string;
  level: number;
  page: number;
}

export interface ExtractedImage {
  page: number;
  buffer: Buffer;
  width: number;
  height: number;
  yPosition?: number;
}

export interface VectorFigure {
  page: number;
  x: number; // PDF points, bottom-left origin
  y: number;
  width: number;
  height: number;
  pathCount: number;
}

// ── Helpers ─────────────────────────────────────────────────────────

function pdfStringValue(obj: unknown): string {
  if (obj instanceof PDFString) return obj.decodeText();
  if (obj instanceof PDFHexString) return obj.decodeText();
  if (typeof obj === 'string') return obj;
  return '';
}

function pdfNumberValue(obj: unknown): number {
  if (obj instanceof PDFNumber) return obj.asNumber();
  if (typeof obj === 'number') return obj;
  return 0;
}

/**
 * Convert PDF color array to CSS hex string.
 * PDF colors are floats 0-1, can be 1 (gray), 3 (RGB), or 4 (CMYK) components.
 */
function colorToHex(colorArray: PDFArray): string | undefined {
  const len = colorArray.size();
  if (len === 0) return undefined;
  if (len === 1) {
    const gray = Math.round(pdfNumberValue(colorArray.get(0)) * 255);
    return `#${gray.toString(16).padStart(2, '0').repeat(3)}`;
  }
  if (len >= 3) {
    const r = Math.round(pdfNumberValue(colorArray.get(0)) * 255);
    const g = Math.round(pdfNumberValue(colorArray.get(1)) * 255);
    const b = Math.round(pdfNumberValue(colorArray.get(2)) * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  return undefined;
}

/**
 * Batch-insert positioned tags into page text at their correct vertical locations.
 * Uses word positions from pdftotext -bbox to map Y coordinates to text lines.
 * Tags without yPosition are appended at the end.
 * All tags are processed in one pass to avoid line-mapping drift.
 */
export function insertTagsAtPositions(
  pageText: string,
  tags: PositionedTag[],
  wordPositions: WordPosition[]
): string {
  if (tags.length === 0) return pageText;

  const positioned = tags.filter((t) => t.yPosition !== undefined);
  const unpositioned = tags.filter((t) => t.yPosition === undefined);

  // If no word positions, append everything
  if (wordPositions.length === 0) {
    let result = pageText;
    for (const tag of tags) {
      result += `\n\n${tag.tag}`;
    }
    return result;
  }

  // Group words into lines by similar yMin
  const sortedWords = [...wordPositions].sort((a, b) => a.yMin - b.yMin || a.xMin - b.xMin);
  const lines: Array<{ yMin: number; yMax: number }> = [];
  let currentLineYMin = sortedWords[0].yMin;
  let currentLineYMax = sortedWords[0].yMax;
  const firstWordHeight = sortedWords[0].yMax - sortedWords[0].yMin;
  const tolerance = Math.max(firstWordHeight * 0.5, 2);

  for (const word of sortedWords) {
    if (Math.abs(word.yMin - currentLineYMin) <= tolerance) {
      currentLineYMax = Math.max(currentLineYMax, word.yMax);
    } else {
      lines.push({ yMin: currentLineYMin, yMax: currentLineYMax });
      currentLineYMin = word.yMin;
      currentLineYMax = word.yMax;
    }
  }
  lines.push({ yMin: currentLineYMin, yMax: currentLineYMax });
  lines.sort((a, b) => a.yMin - b.yMin);

  // Map non-empty text lines 1:1 to word-position lines
  const textLines = pageText.split('\n');
  const nonEmptyLineIndices: number[] = [];
  for (let i = 0; i < textLines.length; i++) {
    if (textLines[i].trim().length > 0) {
      nonEmptyLineIndices.push(i);
    }
  }

  // If line counts don't match, fall back to append all
  if (nonEmptyLineIndices.length !== lines.length) {
    let result = pageText;
    for (const tag of tags) {
      result += `\n\n${tag.tag}`;
    }
    return result;
  }

  // Compute insertion point (text line index) for each positioned tag
  const insertions: Array<{ textLineIdx: number; tag: string; yPos: number }> = [];

  for (const tag of positioned) {
    const y = tag.yPosition ?? 0;
    let insertAfterLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].yMax <= y) {
        insertAfterLineIdx = i;
      } else {
        break;
      }
    }

    if (insertAfterLineIdx < 0) {
      // Above all text: prepend
      insertions.push({ textLineIdx: -1, tag: tag.tag, yPos: y });
    } else if (insertAfterLineIdx >= lines.length - 1) {
      // Below all text: append
      insertions.push({ textLineIdx: Infinity, tag: tag.tag, yPos: y });
    } else {
      insertions.push({
        textLineIdx: nonEmptyLineIndices[insertAfterLineIdx],
        tag: tag.tag,
        yPos: y,
      });
    }
  }

  // Sort bottom-to-top so splices don't shift earlier indices
  insertions.sort((a, b) => b.textLineIdx - a.textLineIdx || b.yPos - a.yPos);

  const resultLines = [...textLines];

  // Separate by type
  const prependTags: string[] = [];
  const appendTags: string[] = [];

  for (const ins of insertions) {
    if (ins.textLineIdx === -1) {
      prependTags.push(ins.tag);
    } else if (ins.textLineIdx === Infinity) {
      appendTags.push(ins.tag);
    } else {
      resultLines.splice(ins.textLineIdx + 1, 0, '', ins.tag);
    }
  }

  let result = resultLines.join('\n');

  for (const tag of prependTags) {
    result = tag + '\n\n' + result;
  }

  for (const tag of [...appendTags, ...unpositioned.map((t) => t.tag)]) {
    result += `\n\n${tag}`;
  }

  return result;
}

@Injectable()
export class PdfAnnotationExtractor {
  private readonly logger = new Logger(PdfAnnotationExtractor.name);

  /**
   * Extract all annotations from a PDF buffer, grouped by page.
   * Uses pdf-lib to parse annotation dictionaries.
   */
  async extractAnnotations(buffer: Buffer): Promise<Map<number, PageAnnotations>> {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const result = new Map<number, PageAnnotations>();

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const page = pages[pageIdx];
      const pageNum = pageIdx + 1;
      const annotations: PageAnnotations = {
        highlights: [],
        comments: [],
        formFields: [],
      };

      const annotsRef = page.node.get(PDFName.of('Annots'));
      if (!annotsRef) continue;

      const annotsArray = page.node.lookup(PDFName.of('Annots'));
      if (!(annotsArray instanceof PDFArray)) continue;

      for (let i = 0; i < annotsArray.size(); i++) {
        try {
          const annotRef = annotsArray.get(i);
          const annotDict = annotRef instanceof PDFRef ? pdfDoc.context.lookup(annotRef) : annotRef;
          if (!(annotDict instanceof PDFDict)) continue;

          const subtype = annotDict.get(PDFName.of('Subtype'));
          const subtypeStr = subtype instanceof PDFName ? subtype.decodeText() : '';

          if (
            subtypeStr === 'Highlight' ||
            subtypeStr === 'Underline' ||
            subtypeStr === 'StrikeOut' ||
            subtypeStr === 'Squiggly'
          ) {
            this.extractHighlightAnnotation(annotDict, annotations);
          } else if (subtypeStr === 'Text' || subtypeStr === 'FreeText') {
            this.extractCommentAnnotation(annotDict, annotations);
          } else if (subtypeStr === 'Widget') {
            this.extractWidgetAnnotation(annotDict, annotations);
          }
        } catch (err) {
          this.logger.warn(`Failed to extract annotation on page ${pageNum}: ${String(err)}`);
        }
      }

      // Also extract form fields from AcroForm
      if (pageIdx === 0) {
        this.extractAcroFormFields(pdfDoc, result);
      }

      if (
        annotations.highlights.length > 0 ||
        annotations.comments.length > 0 ||
        annotations.formFields.length > 0
      ) {
        result.set(pageNum, annotations);
      }
    }

    return result;
  }

  private extractHighlightAnnotation(annotDict: PDFDict, annotations: PageAnnotations): void {
    const quadPointsArr = annotDict.get(PDFName.of('QuadPoints'));
    const quadPoints: number[][] = [];
    if (quadPointsArr instanceof PDFArray) {
      // QuadPoints: groups of 8 numbers (4 x,y pairs per quad)
      const values: number[] = [];
      for (let j = 0; j < quadPointsArr.size(); j++) {
        values.push(pdfNumberValue(quadPointsArr.get(j)));
      }
      for (let j = 0; j < values.length; j += 8) {
        quadPoints.push(values.slice(j, j + 8));
      }
    }

    const colorArr = annotDict.get(PDFName.of('C'));
    const color = colorArr instanceof PDFArray ? colorToHex(colorArr) : undefined;

    const contentsVal = annotDict.get(PDFName.of('Contents'));
    const contents = pdfStringValue(contentsVal);

    annotations.highlights.push({ quadPoints, color, contents: contents || undefined });
  }

  private extractCommentAnnotation(annotDict: PDFDict, annotations: PageAnnotations): void {
    const contentsVal = annotDict.get(PDFName.of('Contents'));
    const text = pdfStringValue(contentsVal);
    if (!text.trim()) return;

    const authorVal = annotDict.get(PDFName.of('T'));
    const author = pdfStringValue(authorVal);

    const rectArr = annotDict.get(PDFName.of('Rect'));
    const rect: number[] = [];
    if (rectArr instanceof PDFArray) {
      for (let j = 0; j < rectArr.size(); j++) {
        rect.push(pdfNumberValue(rectArr.get(j)));
      }
    }

    annotations.comments.push({
      author: author || undefined,
      text: text.trim(),
      rect,
    });
  }

  private extractWidgetAnnotation(annotDict: PDFDict, annotations: PageAnnotations): void {
    const fieldNameVal = annotDict.get(PDFName.of('T'));
    const fieldName = pdfStringValue(fieldNameVal);

    const fieldValueVal = annotDict.get(PDFName.of('V'));
    const fieldValue = pdfStringValue(fieldValueVal);

    const rectArr = annotDict.get(PDFName.of('Rect'));
    const rect: number[] = [];
    if (rectArr instanceof PDFArray) {
      for (let j = 0; j < rectArr.size(); j++) {
        rect.push(pdfNumberValue(rectArr.get(j)));
      }
    }

    if (fieldName || fieldValue) {
      annotations.formFields.push({
        name: fieldName || '(unnamed)',
        value: fieldValue,
        rect: rect.length === 4 ? rect : undefined,
      });
    }
  }

  /**
   * Extract form fields from the document-level AcroForm.
   * Distributes fields to pages based on their Widget annotation page reference.
   */
  private extractAcroFormFields(pdfDoc: PDFDocument, result: Map<number, PageAnnotations>): void {
    try {
      const form = pdfDoc.getForm();
      const fields = form.getFields();

      for (const field of fields) {
        const name = field.getName();
        let value = '';

        // Try to get the value from the field dictionary directly
        const fieldDict = field.acroField.dict;
        const vVal = fieldDict.get(PDFName.of('V'));
        value = pdfStringValue(vVal);

        if (!name && !value) continue;

        // Try to find which page this field belongs to
        const widgets = field.acroField.getWidgets();
        let pageNum = 1; // default to page 1
        if (widgets.length > 0) {
          const pages = pdfDoc.getPages();
          for (let pi = 0; pi < pages.length; pi++) {
            const pageRef = pages[pi].ref;
            const widgetPageRef = widgets[0].P();
            if (widgetPageRef && pageRef === widgetPageRef) {
              pageNum = pi + 1;
              break;
            }
          }
        }

        const existing = result.get(pageNum) ?? { highlights: [], comments: [], formFields: [] };
        // Avoid duplicates with widget-level extraction
        const isDuplicate = existing.formFields.some((f) => f.name === name && f.value === value);
        if (!isDuplicate) {
          existing.formFields.push({ name: name || '(unnamed)', value });
          result.set(pageNum, existing);
        }
      }
    } catch {
      // AcroForm may not exist or may be corrupted
    }
  }

  /**
   * Extract word-level bounding boxes for a page range.
   * Uses: pdftotext -bbox -f {start} -l {end} filePath -
   * Returns word positions for matching annotations to text.
   */
  async extractWordPositions(
    filePath: string,
    startPage: number,
    endPage: number
  ): Promise<Map<number, WordPosition[]>> {
    const result = new Map<number, WordPosition[]>();

    try {
      const { stdout } = await execFileAsync(
        'pdftotext',
        ['-bbox', '-f', String(startPage), '-l', String(endPage), filePath, '-'],
        { maxBuffer: 50 * 1024 * 1024 }
      );

      // Parse the HTML/XML output from pdftotext -bbox
      // Format: <page ...> <word xMin="..." yMin="..." xMax="..." yMax="...">text</word> </page>
      const pageRegex = /<page\s[^>]*>/g;
      const wordRegex =
        /<word\s+xMin="([^"]+)"\s+yMin="([^"]+)"\s+xMax="([^"]+)"\s+yMax="([^"]+)"[^>]*>([^<]*)<\/word>/g;

      const pageMatches = [...stdout.matchAll(pageRegex)];
      const pagePositions = pageMatches.map((m) => m.index ?? 0);

      for (let pi = 0; pi < pagePositions.length; pi++) {
        const pageStart = pagePositions[pi];
        const pageEnd = pi + 1 < pagePositions.length ? pagePositions[pi + 1] : stdout.length;
        const pageContent = stdout.slice(pageStart, pageEnd);
        const pageNum = startPage + pi;

        const words: WordPosition[] = [];
        const wordMatches = [...pageContent.matchAll(wordRegex)];
        for (const wordMatch of wordMatches) {
          words.push({
            text: wordMatch[5],
            xMin: parseFloat(wordMatch[1]),
            yMin: parseFloat(wordMatch[2]),
            xMax: parseFloat(wordMatch[3]),
            yMax: parseFloat(wordMatch[4]),
          });
        }

        if (words.length > 0) {
          result.set(pageNum, words);
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to extract word positions: ${String(err)}`);
    }

    return result;
  }

  /**
   * Extract image Y positions from PDF content streams using pdf-lib.
   * Parses each page's content stream to find image draw operations (Do)
   * and tracks the CTM matrix to determine Y position.
   * Returns positions in pdftotext-bbox coordinate space (top-left origin, points).
   */
  private extractImagePositions(
    pdfDoc: PDFDocument,
    startPage: number,
    endPage: number
  ): Map<number, number[]> {
    const result = new Map<number, number[]>();
    const pages = pdfDoc.getPages();

    for (let pageIdx = startPage - 1; pageIdx < Math.min(endPage, pages.length); pageIdx++) {
      const page = pages[pageIdx];
      const pageNum = pageIdx + 1;
      const pageHeight = page.getHeight();

      try {
        // Get the raw content stream bytes
        const contentsRef = page.node.get(PDFName.of('Contents'));
        if (!contentsRef) continue;

        const contentsObj = page.node.lookup(PDFName.of('Contents'));
        let streamBytes: Uint8Array | undefined;

        if (contentsObj instanceof PDFArray) {
          // Multiple content streams, concatenate them
          const parts: Uint8Array[] = [];
          for (let i = 0; i < contentsObj.size(); i++) {
            const ref = contentsObj.get(i);
            const stream = ref instanceof PDFRef ? pdfDoc.context.lookup(ref) : ref;
            if (stream instanceof PDFRawStream) {
              parts.push(getDecodedStreamBytes(stream));
            } else if (stream instanceof PDFStream) {
              parts.push(stream.getContents());
            }
          }
          if (parts.length > 0) {
            const total = parts.reduce((sum, p) => sum + p.length, 0);
            streamBytes = new Uint8Array(total);
            let offset = 0;
            for (const part of parts) {
              streamBytes.set(part, offset);
              offset += part.length;
            }
          }
        } else if (contentsObj instanceof PDFRawStream) {
          streamBytes = getDecodedStreamBytes(contentsObj);
        } else if (contentsObj instanceof PDFStream) {
          streamBytes = contentsObj.getContents();
        }

        if (!streamBytes) continue;

        const content = Buffer.from(streamBytes).toString('latin1');

        // Get the XObject dictionary to verify image subtypes
        const resources = page.node.lookup(PDFName.of('Resources'));
        const xObjects =
          resources instanceof PDFDict ? resources.lookup(PDFName.of('XObject')) : undefined;
        const xObjDict = xObjects instanceof PDFDict ? xObjects : undefined;

        // Simple tokenizer for content stream operators
        // Track graphics state matrix stack to compute Y position on Do
        const yPositions: number[] = [];

        // CTM stack: each entry is [a, b, c, d, e, f] (6-element transform matrix)
        // e = x translation, f = y translation
        type Matrix = [number, number, number, number, number, number];
        const identityMatrix: Matrix = [1, 0, 0, 1, 0, 0];
        const matrixStack: Matrix[] = [];
        let ctm: Matrix = [...identityMatrix];

        const multiplyMatrices = (m1: Matrix, m2: Matrix): Matrix => [
          m1[0] * m2[0] + m1[1] * m2[2],
          m1[0] * m2[1] + m1[1] * m2[3],
          m1[2] * m2[0] + m1[3] * m2[2],
          m1[2] * m2[1] + m1[3] * m2[3],
          m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
          m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
        ];

        // Tokenize: split on whitespace, handle operators
        const tokens = content.match(/\/?\S+/g) ?? [];
        const operandStack: string[] = [];

        for (const token of tokens) {
          switch (token) {
            case 'q':
              matrixStack.push([...ctm]);
              break;
            case 'Q':
              ctm = matrixStack.pop() ?? [...identityMatrix];
              break;
            case 'cm': {
              // operandStack should have [a, b, c, d, e, f]
              if (operandStack.length >= 6) {
                const nums = operandStack.splice(-6).map(Number);
                const m: Matrix = [nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]];
                ctm = multiplyMatrices(m, ctm);
              }
              break;
            }
            case 'Do': {
              // operandStack should have the XObject name (e.g., /Im0)
              const name = operandStack.pop();
              if (!name) break;

              const xObjName = name.startsWith('/') ? name.slice(1) : name;

              // Verify it's an Image XObject (not a Form)
              let isImage = true;
              if (xObjDict) {
                const xObj = xObjDict.lookup(PDFName.of(xObjName));
                if (xObj instanceof PDFDict) {
                  const subtype = xObj.get(PDFName.of('Subtype'));
                  if (subtype instanceof PDFName && subtype.decodeText() !== 'Image') {
                    isImage = false;
                  }
                  if (isImage) {
                    // Check dimensions, skip < 50x50
                    const w = xObj.get(PDFName.of('Width'));
                    const h = xObj.get(PDFName.of('Height'));
                    const imgW = pdfNumberValue(w);
                    const imgH = pdfNumberValue(h);
                    if (imgW < 50 || imgH < 50) isImage = false;
                  }
                } else if (xObj instanceof PDFStream) {
                  const dict = xObj.dict;
                  const subtype = dict.get(PDFName.of('Subtype'));
                  if (subtype instanceof PDFName && subtype.decodeText() !== 'Image') {
                    isImage = false;
                  }
                  if (isImage) {
                    const w = dict.get(PDFName.of('Width'));
                    const h = dict.get(PDFName.of('Height'));
                    const imgW = pdfNumberValue(w);
                    const imgH = pdfNumberValue(h);
                    if (imgW < 50 || imgH < 50) isImage = false;
                  }
                }
              }

              if (isImage) {
                // Y position in PDF coords (bottom-left origin) is ctm[5] (f component)
                const yPdf = ctm[5];
                // Convert to pdftotext coords (top-left origin)
                const yTop = pageHeight - yPdf;
                yPositions.push(yTop);
              }
              break;
            }
            default:
              // It's an operand (number or name), push to stack
              operandStack.push(token);
              break;
          }
        }

        if (yPositions.length > 0) {
          result.set(pageNum, yPositions);
        }
      } catch (err) {
        this.logger.warn(`Failed to extract image positions for page ${pageNum}: ${String(err)}`);
      }
    }

    return result;
  }

  /**
   * Extract images from a page range using pdfimages CLI.
   * Uses: pdfimages -png -f {start} -l {end} -p filePath {tmpDir}/img
   * If pdfBuffer is provided, also extracts Y positions from content streams.
   */
  async extractImages(
    filePath: string,
    startPage: number,
    endPage: number,
    pdfBuffer?: Buffer
  ): Promise<ExtractedImage[]> {
    const images: ExtractedImage[] = [];
    const tmpDir = await mkdtemp(join(tmpdir(), 'pdfimages-'));

    try {
      const prefix = join(tmpDir, 'img');
      await execFileAsync('pdfimages', [
        '-png',
        '-f',
        String(startPage),
        '-l',
        String(endPage),
        '-p',
        filePath,
        prefix,
      ]);

      const files = await readdir(tmpDir);
      const pngFiles = files.filter((f) => f.endsWith('.png')).sort();

      for (const pngFile of pngFiles) {
        // Filename format: img-{pageNum}-{imgNum}.png
        const pageMatch = /img-(\d+)-\d+\.png/.exec(pngFile);
        if (!pageMatch) continue;

        const pageNum = parseInt(pageMatch[1], 10);
        const imgPath = join(tmpDir, pngFile);
        const imgBuffer = await readFile(imgPath);

        // Get dimensions from PNG header (bytes 16-23)
        if (imgBuffer.length >= 24) {
          const width = imgBuffer.readUInt32BE(16);
          const height = imgBuffer.readUInt32BE(20);

          // Skip very small images (icons, bullets)
          if (width < 50 || height < 50) continue;

          images.push({
            page: pageNum,
            buffer: Buffer.from(imgBuffer),
            width,
            height,
          });
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to extract images: ${String(err)}`);
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }

    // Assign Y positions from content stream parsing
    if (pdfBuffer && images.length > 0) {
      try {
        const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
        const positionsMap = this.extractImagePositions(pdfDoc, startPage, endPage);

        // Group extracted images by page
        const imagesByPage = new Map<number, ExtractedImage[]>();
        for (const img of images) {
          const existing = imagesByPage.get(img.page) ?? [];
          existing.push(img);
          imagesByPage.set(img.page, existing);
        }

        // For each page, zip positions with images by index (both in content-stream order)
        for (const [pageNum, pageImages] of imagesByPage) {
          const positions = positionsMap.get(pageNum);
          if (!positions || positions.length !== pageImages.length) {
            // Count mismatch: skip position assignment for this page (graceful fallback)
            continue;
          }
          for (let i = 0; i < pageImages.length; i++) {
            pageImages[i].yPosition = positions[i];
          }
        }
      } catch (err) {
        this.logger.warn(`Failed to assign image positions: ${String(err)}`);
      }
    }

    return images;
  }

  /**
   * Detect vector figure regions (charts, diagrams) in PDF content streams.
   * Parses path construction/painting operators to find clusters of vector paths
   * that likely represent figures rather than text or borders.
   */
  extractVectorFigures(
    pdfDoc: PDFDocument,
    startPage: number,
    endPage: number,
    wordPositionsMap: Map<number, WordPosition[]>,
    pageHeights: Map<number, number>
  ): Map<number, VectorFigure[]> {
    const result = new Map<number, VectorFigure[]>();
    const pages = pdfDoc.getPages();

    for (let pageIdx = startPage - 1; pageIdx < Math.min(endPage, pages.length); pageIdx++) {
      const page = pages[pageIdx];
      const pageNum = pageIdx + 1;
      const pageHeight = pageHeights.get(pageNum) ?? page.getHeight();
      const pageWidth = page.getWidth();

      try {
        // Get content stream bytes (same approach as extractImagePositions)
        const contentsRef = page.node.get(PDFName.of('Contents'));
        if (!contentsRef) continue;

        const contentsObj = page.node.lookup(PDFName.of('Contents'));
        let streamBytes: Uint8Array | undefined;

        if (contentsObj instanceof PDFArray) {
          const parts: Uint8Array[] = [];
          for (let i = 0; i < contentsObj.size(); i++) {
            const ref = contentsObj.get(i);
            const stream = ref instanceof PDFRef ? pdfDoc.context.lookup(ref) : ref;
            if (stream instanceof PDFRawStream) {
              parts.push(getDecodedStreamBytes(stream));
            } else if (stream instanceof PDFStream) {
              parts.push(stream.getContents());
            }
          }
          if (parts.length > 0) {
            const total = parts.reduce((sum, p) => sum + p.length, 0);
            streamBytes = new Uint8Array(total);
            let offset = 0;
            for (const part of parts) {
              streamBytes.set(part, offset);
              offset += part.length;
            }
          }
        } else if (contentsObj instanceof PDFRawStream) {
          streamBytes = getDecodedStreamBytes(contentsObj);
        } else if (contentsObj instanceof PDFStream) {
          streamBytes = contentsObj.getContents();
        }

        if (!streamBytes) continue;

        const content = Buffer.from(streamBytes).toString('latin1');

        // Get the XObject dictionary for Form XObject recursion
        const resources = page.node.lookup(PDFName.of('Resources'));
        const xObjects =
          resources instanceof PDFDict ? resources.lookup(PDFName.of('XObject')) : undefined;
        const xObjDict = xObjects instanceof PDFDict ? xObjects : undefined;

        // Parse content stream for path operations, recursing into Form XObjects
        const MAX_DECODED_PER_PAGE = 20 * 1024 * 1024; // 20MB budget for all streams on a page
        let totalDecodedBytes = streamBytes.length;

        interface RawRegion {
          xMin: number;
          yMin: number;
          xMax: number;
          yMax: number;
        }
        const rawRegions: RawRegion[] = [];

        type Matrix = [number, number, number, number, number, number];
        const identityMatrix: Matrix = [1, 0, 0, 1, 0, 0];

        const multiplyMatrices = (m1: Matrix, m2: Matrix): Matrix => [
          m1[0] * m2[0] + m1[1] * m2[2],
          m1[0] * m2[1] + m1[1] * m2[3],
          m1[2] * m2[0] + m1[3] * m2[2],
          m1[2] * m2[1] + m1[3] * m2[3],
          m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
          m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
        ];

        /**
         * Parse a content stream and collect path regions into rawRegions.
         * Called for both the page stream and any Form XObject streams.
         */
        const parseContentStream = (
          streamContent: string,
          initialCtm: Matrix,
          resourceDict: PDFDict | undefined,
          depth: number
        ): void => {
          if (depth > 3) return; // prevent deep recursion

          const matrixStack: Matrix[] = [];
          let ctm: Matrix = [...initialCtm];

          const applyCtm = (x: number, y: number): { x: number; y: number } => ({
            x: ctm[0] * x + ctm[2] * y + ctm[4],
            y: ctm[1] * x + ctm[3] * y + ctm[5],
          });

          let currentPathPoints: Array<{ x: number; y: number }> = [];
          let fillIsWhite = false;

          const flushPath = (painted: boolean, isFill: boolean): void => {
            if (!painted || currentPathPoints.length === 0 || (isFill && fillIsWhite)) {
              currentPathPoints = [];
              return;
            }

            let xMin = Infinity;
            let yMin = Infinity;
            let xMax = -Infinity;
            let yMax = -Infinity;
            for (const pt of currentPathPoints) {
              if (pt.x < xMin) xMin = pt.x;
              if (pt.y < yMin) yMin = pt.y;
              if (pt.x > xMax) xMax = pt.x;
              if (pt.y > yMax) yMax = pt.y;
            }

            const w = xMax - xMin;
            const h = yMax - yMin;

            if (w < 5 && h < 5) {
              currentPathPoints = [];
              return;
            }

            if (w > pageWidth * 0.9 && h > pageHeight * 0.9) {
              currentPathPoints = [];
              return;
            }

            rawRegions.push({ xMin, yMin, xMax, yMax });
            currentPathPoints = [];
          };

          // Resolve XObject dict for this stream (Form XObjects may have their own Resources)
          const localXObjects = resourceDict
            ? resourceDict.lookup(PDFName.of('XObject'))
            : undefined;
          const localXObjDict = localXObjects instanceof PDFDict ? localXObjects : undefined;

          const tokens = streamContent.match(/\/?\S+/g) ?? [];
          const operandStack: string[] = [];

          for (const token of tokens) {
            switch (token) {
              case 'q':
                matrixStack.push([...ctm]);
                break;
              case 'Q':
                ctm = matrixStack.pop() ?? [...initialCtm];
                break;
              case 'cm': {
                if (operandStack.length >= 6) {
                  const nums = operandStack.splice(-6).map(Number);
                  const m: Matrix = [nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]];
                  ctm = multiplyMatrices(m, ctm);
                }
                break;
              }
              case 'Do': {
                // Check if this is a Form XObject and recurse into it
                const name = operandStack.pop();
                if (!name) break;
                const xObjName = name.startsWith('/') ? name.slice(1) : name;

                // Try local resources first, then page-level
                const dict = localXObjDict ?? xObjDict;
                if (!dict) break;

                const xObj = dict.lookup(PDFName.of(xObjName));
                if (!xObj) break;

                // Get the stream dict (works for both PDFRawStream and PDFStream)
                const objDict =
                  xObj instanceof PDFRawStream
                    ? xObj.dict
                    : xObj instanceof PDFStream
                      ? xObj.dict
                      : xObj instanceof PDFDict
                        ? xObj
                        : undefined;
                if (!objDict) break;

                const subtype = objDict.get(PDFName.of('Subtype'));
                if (!(subtype instanceof PDFName) || subtype.decodeText() !== 'Form') break;

                // Get the Form XObject's content stream
                let formBytes: Uint8Array | undefined;
                if (xObj instanceof PDFRawStream) {
                  formBytes = getDecodedStreamBytes(xObj);
                } else if (xObj instanceof PDFStream) {
                  formBytes = xObj.getContents();
                }
                if (!formBytes || formBytes.length === 0) break;

                // Check per-page decoded bytes budget
                totalDecodedBytes += formBytes.length;
                if (totalDecodedBytes > MAX_DECODED_PER_PAGE) break;

                // Apply the Form's own Matrix if present
                let formCtm: Matrix = [...ctm];
                const matrixArr = objDict.get(PDFName.of('Matrix'));
                if (matrixArr instanceof PDFArray && matrixArr.size() === 6) {
                  const fm: Matrix = [
                    pdfNumberValue(matrixArr.get(0)),
                    pdfNumberValue(matrixArr.get(1)),
                    pdfNumberValue(matrixArr.get(2)),
                    pdfNumberValue(matrixArr.get(3)),
                    pdfNumberValue(matrixArr.get(4)),
                    pdfNumberValue(matrixArr.get(5)),
                  ];
                  formCtm = multiplyMatrices(fm, ctm);
                }

                // Get Form's own Resources (may override page resources)
                const formResources = objDict.lookup(PDFName.of('Resources'));
                const formResourceDict =
                  formResources instanceof PDFDict ? formResources : resourceDict;

                const formContent = Buffer.from(formBytes).toString('latin1');
                parseContentStream(formContent, formCtm, formResourceDict, depth + 1);
                break;
              }
              // Path construction
              case 'm': {
                if (operandStack.length >= 2) {
                  const y = Number(operandStack.pop());
                  const x = Number(operandStack.pop());
                  const pt = applyCtm(x, y);
                  currentPathPoints.push(pt);
                }
                break;
              }
              case 'l': {
                if (operandStack.length >= 2) {
                  const y = Number(operandStack.pop());
                  const x = Number(operandStack.pop());
                  const pt = applyCtm(x, y);
                  currentPathPoints.push(pt);
                }
                break;
              }
              case 'c': {
                if (operandStack.length >= 6) {
                  const nums = operandStack.splice(-6).map(Number);
                  currentPathPoints.push(applyCtm(nums[0], nums[1]));
                  currentPathPoints.push(applyCtm(nums[2], nums[3]));
                  currentPathPoints.push(applyCtm(nums[4], nums[5]));
                }
                break;
              }
              case 'v': {
                if (operandStack.length >= 4) {
                  const nums = operandStack.splice(-4).map(Number);
                  currentPathPoints.push(applyCtm(nums[0], nums[1]));
                  currentPathPoints.push(applyCtm(nums[2], nums[3]));
                }
                break;
              }
              case 'y': {
                if (operandStack.length >= 4) {
                  const nums = operandStack.splice(-4).map(Number);
                  currentPathPoints.push(applyCtm(nums[0], nums[1]));
                  currentPathPoints.push(applyCtm(nums[2], nums[3]));
                }
                break;
              }
              case 're': {
                if (operandStack.length >= 4) {
                  const nums = operandStack.splice(-4).map(Number);
                  const [rx, ry, rw, rh] = nums;
                  currentPathPoints.push(applyCtm(rx, ry));
                  currentPathPoints.push(applyCtm(rx + rw, ry));
                  currentPathPoints.push(applyCtm(rx + rw, ry + rh));
                  currentPathPoints.push(applyCtm(rx, ry + rh));
                }
                break;
              }
              // Path painting operators: stroke-only
              case 'S':
              case 's':
                flushPath(true, false);
                break;
              // Fill-only
              case 'f':
              case 'F':
              case 'f*':
                flushPath(true, true);
                break;
              // Fill-and-stroke
              case 'B':
              case 'B*':
              case 'b':
              case 'b*':
                flushPath(true, true);
                break;
              case 'n':
                flushPath(false, false);
                break;
              // Color operators: track fill color to detect white fills
              case 'rg': {
                if (operandStack.length >= 3) {
                  const b = Number(operandStack.pop());
                  const g = Number(operandStack.pop());
                  const r = Number(operandStack.pop());
                  fillIsWhite = r > 0.95 && g > 0.95 && b > 0.95;
                }
                break;
              }
              case 'g': {
                if (operandStack.length >= 1) {
                  const gray = Number(operandStack.pop());
                  fillIsWhite = gray > 0.95;
                }
                break;
              }
              case 'k': {
                if (operandStack.length >= 4) {
                  const nums = operandStack.splice(-4).map(Number);
                  fillIsWhite = nums.every((n) => n < 0.05);
                }
                break;
              }
              case 'RG':
              case 'G':
              case 'K':
              case 'cs':
              case 'CS':
              case 'sc':
              case 'SC':
              case 'scn':
              case 'SCN':
                operandStack.length = 0;
                break;
              default:
                operandStack.push(token);
                break;
            }
          }
        };

        // Get page-level Resources dict for XObject lookups
        const pageResourceDict = resources instanceof PDFDict ? resources : undefined;
        parseContentStream(content, identityMatrix, pageResourceDict, 0);

        // Safety limit: skip if too many raw regions (decorative/complex backgrounds)
        if (rawRegions.length > VECTOR_FIG_MAX_RAW_PATHS) {
          this.logger.debug(
            `Vector figure detection: skipping page ${pageNum} (${rawRegions.length} raw path regions exceeds limit)`
          );
          continue;
        }

        if (rawRegions.length < VECTOR_FIG_MIN_PATHS) continue;

        // Cluster nearby/overlapping regions using iterative merge
        let clusters = rawRegions.map((r) => ({
          xMin: r.xMin,
          yMin: r.yMin,
          xMax: r.xMax,
          yMax: r.yMax,
          pathCount: 1,
        }));

        let merged = true;
        let mergeIterations = 0;
        while (merged && mergeIterations < 50) {
          mergeIterations++;
          merged = false;
          clusters.sort((a, b) => a.yMin - b.yMin);
          const next: typeof clusters = [];

          for (const cluster of clusters) {
            let didMerge = false;
            for (const existing of next) {
              // Check if overlapping or within merge distance
              const overlapOrClose =
                cluster.xMin <= existing.xMax + VECTOR_FIG_MERGE_DISTANCE_PTS &&
                cluster.xMax >= existing.xMin - VECTOR_FIG_MERGE_DISTANCE_PTS &&
                cluster.yMin <= existing.yMax + VECTOR_FIG_MERGE_DISTANCE_PTS &&
                cluster.yMax >= existing.yMin - VECTOR_FIG_MERGE_DISTANCE_PTS;

              if (overlapOrClose) {
                existing.xMin = Math.min(existing.xMin, cluster.xMin);
                existing.yMin = Math.min(existing.yMin, cluster.yMin);
                existing.xMax = Math.max(existing.xMax, cluster.xMax);
                existing.yMax = Math.max(existing.yMax, cluster.yMax);
                existing.pathCount += cluster.pathCount;
                didMerge = true;
                merged = true;
                break;
              }
            }
            if (!didMerge) {
              next.push({ ...cluster });
            }
          }
          clusters = next;
        }

        // Filter clusters by minimum size and path count
        const figures: VectorFigure[] = [];
        const wordPositions = wordPositionsMap.get(pageNum) ?? [];

        for (const cluster of clusters) {
          const w = cluster.xMax - cluster.xMin;
          const h = cluster.yMax - cluster.yMin;

          if (w < VECTOR_FIG_MIN_WIDTH_PTS || h < VECTOR_FIG_MIN_HEIGHT_PTS) continue;
          if (cluster.pathCount < VECTOR_FIG_MIN_PATHS) continue;

          // Check text coverage: convert figure bbox to pdftotext coords (top-left origin)
          const figTopLeftY = pageHeight - cluster.yMax;
          const figBottomLeftY = pageHeight - cluster.yMin;

          let textOverlapArea = 0;
          for (const word of wordPositions) {
            const overlapXMin = Math.max(cluster.xMin, word.xMin);
            const overlapXMax = Math.min(cluster.xMax, word.xMax);
            const overlapYMin = Math.max(figTopLeftY, word.yMin);
            const overlapYMax = Math.min(figBottomLeftY, word.yMax);
            if (overlapXMin < overlapXMax && overlapYMin < overlapYMax) {
              textOverlapArea += (overlapXMax - overlapXMin) * (overlapYMax - overlapYMin);
            }
          }

          const figArea = w * h;
          if (figArea > 0 && textOverlapArea / figArea > VECTOR_FIG_MAX_TEXT_COVERAGE) continue;

          figures.push({
            page: pageNum,
            x: cluster.xMin,
            y: cluster.yMin,
            width: w,
            height: h,
            pathCount: cluster.pathCount,
          });
        }

        if (figures.length > 0) {
          result.set(pageNum, figures);
        }
      } catch (err) {
        this.logger.warn(`Failed to extract vector figures for page ${pageNum}: ${String(err)}`);
      }
    }

    return result;
  }

  /**
   * Render detected vector figures as PNG images using pdftocairo.
   * Each figure region is cropped and rendered at the configured DPI.
   */
  async renderVectorFigures(
    filePath: string,
    vectorFigures: Map<number, VectorFigure[]>,
    pageDimensions: Map<number, { width: number; height: number }>
  ): Promise<ExtractedImage[]> {
    const images: ExtractedImage[] = [];
    const tmpDir = await mkdtemp(join(tmpdir(), 'vector-fig-'));

    try {
      let figIdx = 0;
      for (const [pageNum, figures] of vectorFigures) {
        const dims = pageDimensions.get(pageNum) ?? { width: 612, height: 792 };

        for (const fig of figures) {
          try {
            // Add padding and clamp to page bounds
            const padded = {
              x: Math.max(0, fig.x - VECTOR_FIG_PADDING_PTS),
              y: Math.max(0, fig.y - VECTOR_FIG_PADDING_PTS),
              width: Math.min(
                fig.width + 2 * VECTOR_FIG_PADDING_PTS,
                dims.width - Math.max(0, fig.x - VECTOR_FIG_PADDING_PTS)
              ),
              height: Math.min(
                fig.height + 2 * VECTOR_FIG_PADDING_PTS,
                dims.height - Math.max(0, fig.y - VECTOR_FIG_PADDING_PTS)
              ),
            };

            // Convert from PDF bottom-left to top-left origin for pdftocairo
            const yTop = dims.height - (padded.y + padded.height);

            // Scale points to pixels
            const scale = VECTOR_FIG_RENDER_DPI / 72;
            const px = Math.round(padded.x * scale);
            const py = Math.round(yTop * scale);
            const pw = Math.round(padded.width * scale);
            const ph = Math.round(padded.height * scale);

            const outPrefix = join(tmpDir, `fig-${figIdx}`);
            await execFileAsync('pdftocairo', [
              '-png',
              '-singlefile',
              '-r',
              String(VECTOR_FIG_RENDER_DPI),
              '-x',
              String(px),
              '-y',
              String(py),
              '-W',
              String(pw),
              '-H',
              String(ph),
              '-f',
              String(pageNum),
              '-l',
              String(pageNum),
              filePath,
              outPrefix,
            ]);

            const pngPath = `${outPrefix}.png`;
            const imgBuffer = await readFile(pngPath);

            // Extract dimensions from PNG header
            if (imgBuffer.length >= 24) {
              const width = imgBuffer.readUInt32BE(16);
              const height = imgBuffer.readUInt32BE(20);

              // Skip if rendering produced a very small image
              if (width >= 50 && height >= 50) {
                // yPosition in pdftotext coords (top-left origin) for text insertion
                const yPosition = dims.height - (fig.y + fig.height);

                images.push({
                  page: pageNum,
                  buffer: Buffer.from(imgBuffer),
                  width,
                  height,
                  yPosition,
                });
              }
            }

            figIdx++;
          } catch (err) {
            this.logger.warn(`Failed to render vector figure on page ${pageNum}: ${String(err)}`);
            figIdx++;
          }
        }
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }

    return images;
  }

  /**
   * Extract document outline/bookmarks using pdf-lib.
   */
  async extractOutline(buffer: Buffer): Promise<OutlineEntry[]> {
    const entries: OutlineEntry[] = [];

    try {
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const catalog = pdfDoc.context.lookup(pdfDoc.context.trailerInfo.Root);
      if (!(catalog instanceof PDFDict)) return entries;

      const outlinesRef = catalog.get(PDFName.of('Outlines'));
      if (!outlinesRef) return entries;

      const outlines = catalog.lookup(PDFName.of('Outlines'));
      if (!(outlines instanceof PDFDict)) return entries;

      const firstRef = outlines.get(PDFName.of('First'));
      if (!firstRef) return entries;

      const pages = pdfDoc.getPages();
      const pageRefs = pages.map((p) => p.ref);

      this.walkOutlineTree(pdfDoc, firstRef, pageRefs, entries, 1);
    } catch (err) {
      this.logger.warn(`Failed to extract outline: ${String(err)}`);
    }

    return entries;
  }

  private walkOutlineTree(
    pdfDoc: PDFDocument,
    nodeRef: unknown,
    pageRefs: PDFRef[],
    entries: OutlineEntry[],
    level: number
  ): void {
    let current = nodeRef;
    const visited = new Set<string>();

    while (current) {
      const node = current instanceof PDFRef ? pdfDoc.context.lookup(current) : current;
      if (!(node instanceof PDFDict)) break;

      // Prevent infinite loops
      const refStr = current instanceof PDFRef ? current.toString() : String(entries.length);
      if (visited.has(refStr)) break;
      visited.add(refStr);

      // Get title
      const titleVal = node.get(PDFName.of('Title'));
      const title = pdfStringValue(titleVal);

      if (title) {
        // Get destination page
        let pageNum: number | undefined;

        // Try /Dest first
        const dest = node.get(PDFName.of('Dest'));
        if (dest instanceof PDFArray && dest.size() > 0) {
          const pageRef = dest.get(0);
          if (pageRef instanceof PDFRef) {
            const idx = pageRefs.indexOf(pageRef);
            if (idx >= 0) pageNum = idx + 1;
          }
        }

        // Try /A (action) with /D (destination)
        if (pageNum === undefined) {
          const action = node.lookup(PDFName.of('A'));
          if (action instanceof PDFDict) {
            const actionDest = action.get(PDFName.of('D'));
            if (actionDest instanceof PDFArray && actionDest.size() > 0) {
              const pageRef = actionDest.get(0);
              if (pageRef instanceof PDFRef) {
                const idx = pageRefs.indexOf(pageRef);
                if (idx >= 0) pageNum = idx + 1;
              }
            }
          }
        }

        if (pageNum !== undefined) {
          entries.push({ title, level, page: pageNum });
        }
      }

      // Recurse into children
      const firstChild = node.get(PDFName.of('First'));
      if (firstChild) {
        this.walkOutlineTree(pdfDoc, firstChild, pageRefs, entries, level + 1);
      }

      // Move to next sibling
      current = node.get(PDFName.of('Next'));
    }
  }

  /**
   * Find highlighted text by matching annotation quad points to word positions.
   * Returns the text that falls within the highlight regions.
   */
  findHighlightedText(
    highlight: HighlightAnnotation,
    wordPositions: WordPosition[],
    pageHeight: number
  ): string {
    if (highlight.quadPoints.length === 0) return highlight.contents ?? '';

    const matchedWords: string[] = [];

    for (const quad of highlight.quadPoints) {
      if (quad.length < 8) continue;

      // QuadPoints in PDF coords (origin bottom-left).
      // pdftotext -bbox uses top-left origin.
      // Convert: yTop = pageHeight - yPdf
      const xs = [quad[0], quad[2], quad[4], quad[6]];
      const ys = [quad[1], quad[3], quad[5], quad[7]];
      const xMin = Math.min(...xs);
      const xMax = Math.max(...xs);
      // Convert from PDF bottom-left to pdftotext top-left coords
      const yMinPdf = Math.min(...ys);
      const yMaxPdf = Math.max(...ys);
      const yMin = pageHeight - yMaxPdf;
      const yMax = pageHeight - yMinPdf;

      for (const word of wordPositions) {
        // Check overlap between word bbox and highlight region
        const overlapX = word.xMin < xMax && word.xMax > xMin;
        const overlapY = word.yMin < yMax && word.yMax > yMin;
        if (overlapX && overlapY) {
          matchedWords.push(word.text);
        }
      }
    }

    return matchedWords.length > 0 ? matchedWords.join(' ') : (highlight.contents ?? '');
  }

  /**
   * Get annotation tags with their Y positions for position-aware insertion.
   * Returns highlights, comments, and form fields as positioned tags.
   */
  getAnnotationTags(
    annotations: PageAnnotations | undefined,
    wordPositions: WordPosition[],
    pageHeight: number
  ): PositionedTag[] {
    if (!annotations) return [];

    const tags: PositionedTag[] = [];

    // Highlights: Y position from bottom of quad points in pdftotext coords
    for (const highlight of annotations.highlights) {
      const highlightedText = this.findHighlightedText(highlight, wordPositions, pageHeight);
      if (!highlightedText.trim()) continue;

      let yPosition: number | undefined;
      if (highlight.quadPoints.length > 0) {
        let minPdfY = Infinity;
        for (const quad of highlight.quadPoints) {
          if (quad.length < 8) continue;
          const ys = [quad[1], quad[3], quad[5], quad[7]];
          minPdfY = Math.min(minPdfY, ...ys);
        }
        if (minPdfY < Infinity) {
          // Bottom of highlight in pdftotext coords (insert after highlighted text)
          yPosition = pageHeight - minPdfY;
        }
      }

      tags.push({
        tag: `[HIGHLIGHTED] ${highlightedText.trim()} [/HIGHLIGHTED]`,
        yPosition,
      });
    }

    // Comments: Y position from annotation rect
    for (const comment of annotations.comments) {
      const authorPart = comment.author ? `COMMENT by ${comment.author}` : 'COMMENT';

      let yPosition: number | undefined;
      if (comment.rect.length === 4) {
        // rect = [x1, y1, x2, y2] in PDF coords (bottom-left origin)
        // y2 is the top of the comment box. Convert to pdftotext coords.
        yPosition = pageHeight - comment.rect[3];
      }

      tags.push({
        tag: `[${authorPart}]: "${comment.text}"`,
        yPosition,
      });
    }

    // Form fields: Y position from widget rect
    for (const field of annotations.formFields) {
      let yPosition: number | undefined;
      if (field.rect && field.rect.length === 4) {
        yPosition = pageHeight - field.rect[3];
      }

      tags.push({
        tag: `[FORM FIELD: ${field.name}] ${field.value}`,
        yPosition,
      });
    }

    return tags;
  }

  /**
   * Build enriched page text: insert annotations at correct vertical positions.
   * Uses getAnnotationTags + insertTagsAtPositions for position-aware placement.
   */
  buildEnrichedPageText(
    pageText: string,
    annotations: PageAnnotations | undefined,
    wordPositions: WordPosition[],
    pageHeight: number
  ): string {
    const tags = this.getAnnotationTags(annotations, wordPositions, pageHeight);
    if (tags.length === 0) return pageText;
    return insertTagsAtPositions(pageText, tags, wordPositions);
  }

  /**
   * Extract text from a page range using pdftotext -layout.
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

  /**
   * Get page height from pdfinfo (needed for coordinate conversion).
   */
  async getPageDimensions(
    filePath: string,
    pageNum: number
  ): Promise<{ width: number; height: number }> {
    try {
      const { stdout } = await execFileAsync('pdfinfo', [
        '-f',
        String(pageNum),
        '-l',
        String(pageNum),
        filePath,
      ]);
      // Look for "Page   N size: WxH pts"
      const sizeMatch = /Page\s+\d+\s+size:\s+([\d.]+)\s+x\s+([\d.]+)/.exec(stdout);
      if (sizeMatch) {
        return {
          width: parseFloat(sizeMatch[1]),
          height: parseFloat(sizeMatch[2]),
        };
      }
      // Fallback to general "Page size:"
      const generalMatch = /Page size:\s+([\d.]+)\s+x\s+([\d.]+)/.exec(stdout);
      if (generalMatch) {
        return {
          width: parseFloat(generalMatch[1]),
          height: parseFloat(generalMatch[2]),
        };
      }
    } catch {
      // Fall through to default
    }
    return { width: 612, height: 792 }; // US Letter default
  }

  /**
   * Plain text extraction from buffer (for chat attachments).
   * Writes to temp file, runs pdftotext, cleans up.
   */
  async extractAllText(buffer: Buffer): Promise<string> {
    const tmpDir = await mkdtemp(join(tmpdir(), 'pdf-text-'));
    const tmpPath = join(tmpDir, 'input.pdf');

    try {
      await writeFile(tmpPath, buffer);
      const { stdout } = await execFileAsync('pdftotext', ['-layout', tmpPath, '-']);
      return stdout;
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Get basic document metadata (page count, file size) from a PDF buffer.
   */
  async getDocumentMetadata(buffer: Buffer): Promise<{ pageCount: number }> {
    const tmpDir = await mkdtemp(join(tmpdir(), 'pdf-info-'));
    const tmpPath = join(tmpDir, 'input.pdf');

    try {
      await writeFile(tmpPath, buffer);
      const { stdout } = await execFileAsync('pdfinfo', [tmpPath]);
      const match = /Pages:\s+(\d+)/.exec(stdout);
      if (!match) {
        throw new Error('Could not determine PDF page count');
      }
      return { pageCount: parseInt(match[1], 10) };
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Extract rich content from a batch of PDF pages.
   * Replaces PdfRichExtractor.extractBatch using pdf-lib + poppler CLI tools.
   */
  async extractBatch(
    buffer: Buffer,
    startPage: number,
    endPage: number,
    overlapBefore: number,
    overlapAfter: number
  ): Promise<BatchExtractionResult> {
    const tmpDir = await mkdtemp(join(tmpdir(), 'pdf-batch-'));
    const tmpPath = join(tmpDir, 'input.pdf');

    try {
      await writeFile(tmpPath, buffer);

      // Get page count for clamping
      const { stdout: infoStdout } = await execFileAsync('pdfinfo', [tmpPath]);
      const pageCountMatch = /Pages:\s+(\d+)/.exec(infoStdout);
      const pageCount = pageCountMatch ? parseInt(pageCountMatch[1], 10) : endPage;

      const effectiveStart = Math.max(1, startPage - overlapBefore);
      const effectiveEnd = Math.min(pageCount, endPage + overlapAfter);

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

      // Extract all in parallel: text, annotations, word positions, images, outline
      const [pages, annotationsMap, wordPositionsMap, extractedImages, outline] = await Promise.all(
        [
          this.extractPageRangeFromFile(tmpPath, effectiveStart, effectiveEnd),
          this.extractAnnotations(buffer),
          this.extractWordPositions(tmpPath, effectiveStart, effectiveEnd),
          this.extractImages(tmpPath, effectiveStart, effectiveEnd),
          this.extractOutline(buffer),
        ]
      );

      // Populate headings from outline
      for (const entry of outline) {
        result.headings.push({
          title: entry.title,
          level: entry.level,
          unit: entry.page,
        });
      }

      // Process each page
      for (let pageNum = effectiveStart; pageNum <= effectiveEnd; pageNum++) {
        const contextOnly = pageNum < startPage || pageNum > endPage;
        const pageData = pages.find((p) => p.page === pageNum);
        const pageText = pageData?.text ?? '';

        if (pageText.trim().length > 0) {
          // Get page height for coordinate conversion
          const { height: pageHeight } = await this.getPageDimensions(tmpPath, pageNum);
          const pageAnnotations = annotationsMap.get(pageNum);
          const pageWords = wordPositionsMap.get(pageNum) ?? [];

          // Build enriched text
          const enrichedText = this.buildEnrichedPageText(
            pageText,
            pageAnnotations,
            pageWords,
            pageHeight
          );

          result.textSegments.push({
            content: enrichedText,
            unit: pageNum,
            contextOnly,
          });

          // Add highlights to result
          if (pageAnnotations) {
            for (const highlight of pageAnnotations.highlights) {
              const text = this.findHighlightedText(highlight, pageWords, pageHeight);
              if (text.trim()) {
                result.highlights.push({
                  unit: pageNum,
                  text: text.trim(),
                  color: highlight.color,
                  contextOnly,
                });
              }
            }

            // Add comments to result
            for (const comment of pageAnnotations.comments) {
              result.comments.push({
                unit: pageNum,
                author: comment.author,
                text: comment.text,
                contextOnly,
              });
            }

            // Add form fields to result
            for (const field of pageAnnotations.formFields) {
              result.formFields.push({
                name: field.name,
                value: field.value,
                unit: pageNum,
              });
            }
          }
        }
      }

      // Add images to result
      for (const img of extractedImages) {
        const contextOnly = img.page < startPage || img.page > endPage;
        result.images.push({
          unit: img.page,
          s3Key: '',
          buffer: img.buffer,
          mimeType: 'image/png',
          width: img.width,
          height: img.height,
          contextOnly,
        });
      }

      return result;
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
