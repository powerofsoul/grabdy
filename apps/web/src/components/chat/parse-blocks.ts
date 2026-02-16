import type { ChatSource } from '@grabdy/contracts';
import { chatSourceSchema, StreamBlock } from '@grabdy/contracts';
import { z } from 'zod';

export interface ParsedBlocks {
  text: string;
  thinkingTexts: string[];
  sources: ChatSource[];
}

/** Matches complete ```block\n...\n``` blocks */
const THINKING_RE = new RegExp(`\`\`\`${StreamBlock.THINKING}\\n([\\s\\S]*?)\`\`\``, 'g');
const SOURCES_RE = new RegExp(`\`\`\`${StreamBlock.SOURCES}\\n([\\s\\S]*?)\`\`\``, 'g');

const sourcesArraySchema = z.array(chatSourceSchema);

/**
 * Check whether `text` is a prefix of `target` (e.g. "thi" is a prefix of "thinking").
 */
function isPrefix(text: string, target: string): boolean {
  return target.startsWith(text);
}

/**
 * Extract thinking and sources blocks from AI-generated content.
 * Returns cleaned text (blocks stripped) plus extracted data.
 * Incomplete blocks (mid-stream) are hidden from display text.
 * Partial thinking text from an incomplete thinking block is still captured.
 */
export function parseBlocks(content: string): ParsedBlocks {
  const thinkingTexts: string[] = [];
  const sources: ChatSource[] = [];

  // Extract complete thinking blocks
  let cleaned = content.replace(THINKING_RE, (_match, body: string) => {
    const trimmed = body.trim();
    if (trimmed.length > 0) {
      thinkingTexts.push(trimmed);
    }
    return '';
  });

  // Extract complete sources blocks
  cleaned = cleaned.replace(SOURCES_RE, (_match, body: string) => {
    try {
      const parsed = JSON.parse(body.trim());
      const result = sourcesArraySchema.safeParse(parsed);
      if (result.success) {
        sources.push(...result.data);
      }
    } catch {
      // Invalid JSON — skip
    }
    return '';
  });

  // Strip trailing incomplete block still being streamed.
  // Matches: `, ``, ```, ```t, ```th, ..., ```thinking, ```thinking\npartial text...
  // Only strips if the text after backticks is a prefix of one of our block names.
  const trailingMatch = cleaned.match(/(?:^|\n)(`{1,3})([\s\S]*)$/);
  if (trailingMatch && trailingMatch[1] === '```') {
    const afterBackticks = trailingMatch[2];

    // Just bare ``` with nothing after — could become any block, strip it
    if (afterBackticks.length === 0) {
      cleaned = cleaned.slice(0, trailingMatch.index === 0 ? 0 : (trailingMatch.index ?? 0));
    } else {
      // Split into name part (before first newline) and body (after)
      const newlineIdx = afterBackticks.indexOf('\n');
      const namePart = newlineIdx === -1 ? afterBackticks : afterBackticks.slice(0, newlineIdx);
      const bodyPart = newlineIdx === -1 ? '' : afterBackticks.slice(newlineIdx + 1);

      if (isPrefix(namePart, StreamBlock.THINKING) || isPrefix(namePart, StreamBlock.SOURCES)) {
        // Capture partial thinking body so the UI can show it live
        if (namePart === StreamBlock.THINKING || isPrefix(namePart, StreamBlock.THINKING)) {
          const trimmedBody = bodyPart.trim();
          if (namePart === StreamBlock.THINKING && trimmedBody.length > 0) {
            thinkingTexts.push(trimmedBody);
          }
        }

        cleaned = cleaned.slice(0, trailingMatch.index === 0 ? 0 : (trailingMatch.index ?? 0));
      }
    }
  } else if (trailingMatch && trailingMatch[1].length < 3) {
    // Bare ` or `` at the very end with nothing meaningful after — could be start of a block fence
    const afterBackticks = trailingMatch[2];
    if (afterBackticks.length === 0) {
      cleaned = cleaned.slice(0, trailingMatch.index === 0 ? 0 : (trailingMatch.index ?? 0));
    }
  }

  return {
    text: cleaned.trim(),
    thinkingTexts,
    sources,
  };
}
