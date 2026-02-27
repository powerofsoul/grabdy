import { countTokens, decodeTokens, encodeTokens } from './tokenizer';

interface SplitOptions {
  maxSizeTokens: number;
  overlapTokens: number;
  minSizeTokens: number;
}

/**
 * Separator hierarchy: paragraphs → lines → sentences → words.
 * Each level preserves progressively finer document structure.
 */
const SEPARATORS = ['\n\n', '\n', '. ', '? ', '! ', '; ', ' '] as const;

/**
 * Recursively split text respecting natural boundaries (paragraphs, sentences, words).
 * Segments exceeding `maxSizeTokens` are split using progressively finer separators.
 * Adjacent small segments are merged back up to `maxSizeTokens`.
 * Overlap tokens from the end of each chunk are prepended to the next chunk.
 *
 * All size measurements use token counts (cl100k_base) for consistent embedding density.
 */
export function splitText(text: string, opts: SplitOptions): string[] {
  if (countTokens(text) <= opts.maxSizeTokens) {
    return text.trim().length > 0 && countTokens(text) >= opts.minSizeTokens ? [text] : [];
  }

  const rawSegments = splitRecursive(text, opts.maxSizeTokens, 0);

  // Merge adjacent small segments
  const merged = mergeSmallSegments(rawSegments, opts.maxSizeTokens, opts.minSizeTokens);

  // Apply overlap
  if (opts.overlapTokens <= 0 || merged.length <= 1) {
    return merged;
  }

  const result: string[] = [merged[0]];
  for (let i = 1; i < merged.length; i++) {
    const prev = merged[i - 1];
    const prevTokens = encodeTokens(prev);
    const overlapStart = Math.max(0, prevTokens.length - opts.overlapTokens);
    const overlapText = decodeTokens(prevTokens.slice(overlapStart));
    result.push(overlapText + merged[i]);
  }

  return result;
}

function splitRecursive(text: string, maxSizeTokens: number, separatorIdx: number): string[] {
  if (countTokens(text) <= maxSizeTokens) {
    return [text];
  }

  // If we've exhausted all separators, hard-split by token count
  if (separatorIdx >= SEPARATORS.length) {
    const tokens = encodeTokens(text);
    const chunks: string[] = [];
    let start = 0;
    while (start < tokens.length) {
      chunks.push(decodeTokens(tokens.slice(start, start + maxSizeTokens)));
      start += maxSizeTokens;
    }
    return chunks;
  }

  const separator = SEPARATORS[separatorIdx];
  const parts = text.split(separator);

  // If the separator doesn't split the text, try the next one
  if (parts.length <= 1) {
    return splitRecursive(text, maxSizeTokens, separatorIdx + 1);
  }

  const segments: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = i < parts.length - 1 ? parts[i] + separator : parts[i];
    if (countTokens(part) > maxSizeTokens) {
      // Recurse with finer separator
      segments.push(...splitRecursive(part, maxSizeTokens, separatorIdx + 1));
    } else {
      segments.push(part);
    }
  }

  return segments;
}

function mergeSmallSegments(
  segments: string[],
  maxSizeTokens: number,
  minSizeTokens: number
): string[] {
  const result: string[] = [];
  let buffer = '';
  let bufferTokens = 0;

  for (const segment of segments) {
    const segTokens = countTokens(segment);
    if (bufferTokens + segTokens <= maxSizeTokens) {
      buffer += segment;
      bufferTokens += segTokens;
    } else {
      if (bufferTokens >= minSizeTokens) {
        result.push(buffer);
      } else if (
        result.length > 0 &&
        countTokens(result[result.length - 1]) + bufferTokens <= maxSizeTokens
      ) {
        result[result.length - 1] += buffer;
      } else if (buffer.length > 0) {
        result.push(buffer);
      }
      buffer = segment;
      bufferTokens = segTokens;
    }
  }

  if (buffer.length > 0) {
    if (bufferTokens >= minSizeTokens) {
      result.push(buffer);
    } else if (
      result.length > 0 &&
      countTokens(result[result.length - 1]) + bufferTokens <= maxSizeTokens
    ) {
      result[result.length - 1] += buffer;
    } else {
      result.push(buffer);
    }
  }

  return result;
}
