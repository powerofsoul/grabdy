/**
 * Block registry — defines fenced code blocks the AI can output.
 * `buildBlockInstructionsPrompt()` generates the prompt section from these definitions.
 */

import { StreamBlock } from '@grabdy/contracts';

interface BlockDefinition {
  purpose: string;
  guidelines: string[];
  example: string;
}

const BLOCKS: Record<StreamBlock, BlockDefinition> = {
  [StreamBlock.THINKING]: {
    purpose:
      "Narrate your reasoning and actions to the user. The UI renders these as collapsible thinking indicators. This is the user's only feedback that work is happening — without it, they see a blank screen.",
    guidelines: [
      "Output a thinking block before every tool call to explain what you're about to do and why.",
      'Output a thinking block between consecutive tool calls to narrate progress or explain next steps.',
      'Keep each block to 1-2 short, natural sentences.',
      'Multiple thinking blocks per response are expected.',
      'Do NOT put thinking blocks after your final answer text.',
    ],
    example: `\`\`\`${StreamBlock.THINKING}\nSearching for revenue data in your documents...\n\`\`\``,
  },
  [StreamBlock.SOURCES]: {
    purpose:
      'List the sources you referenced in your answer. The UI renders these as clickable source chips. Only include sources you actually used in crafting the answer.',
    guidelines: [
      'Place exactly ONE sources block at the END of your response, after the answer text.',
      'Include only sources whose information you used in the answer.',
      'Copy dataSourceId, dataSourceName, score, type (from metadata), and sourceUrl from tool results.',
      'Include location info from the chunk metadata: `pages` for PDFs/DOCX, `sheet`/`rows`/`columns` for XLSX, `rows`/`columns` for CSV.',
      'The JSON must be a valid array of source objects.',
      'Omit the sources block entirely if you did not use any sources (e.g. greetings, clarifications).',
    ],
    example: `\`\`\`${StreamBlock.SOURCES}\n[{"dataSourceId":"abc-123","dataSourceName":"Q4 Report.pdf","score":0.85,"type":"PDF","pages":[1,3]},{"dataSourceId":"def-456","dataSourceName":"Sales Data.xlsx","score":0.72,"type":"XLSX","sheet":"Q4","rows":[5,12],"columns":["Revenue","Quarter"]}]\n\`\`\``,
  },
};

export function buildBlockInstructionsPrompt(): string {
  const lines: string[] = [
    '## Structured Output Blocks — CRITICAL',
    '',
    'You MUST use these special fenced code blocks in your response. The UI extracts and renders them separately — they will NOT appear as code in the chat. Without these blocks, the user gets no feedback while you work and no source attribution.',
    '',
    '**Format:** Standard markdown fenced code blocks with the block name as the language tag.',
    '',
  ];

  for (const [name, block] of Object.entries(BLOCKS)) {
    lines.push(`### \`${name}\` block`);
    lines.push('');
    lines.push(block.purpose);
    lines.push('');
    for (const g of block.guidelines) {
      lines.push(`- ${g}`);
    }
    lines.push('');
    lines.push('Example:');
    lines.push(block.example);
    lines.push('');
  }

  lines.push('### Full response example (follow this pattern)');
  lines.push('');
  lines.push(`\`\`\`${StreamBlock.THINKING}`);
  lines.push('Searching for revenue data in your documents...');
  lines.push('```');
  lines.push('');
  lines.push('[tool call happens here]');
  lines.push('');
  lines.push(`\`\`\`${StreamBlock.THINKING}`);
  lines.push('Found some results. Let me also look for the Q3 comparison...');
  lines.push('```');
  lines.push('');
  lines.push('[another tool call happens here]');
  lines.push('');
  lines.push("Here's what I found about Q4 revenue: ...");
  lines.push('');
  lines.push(`\`\`\`${StreamBlock.SOURCES}`);
  lines.push(
    '[{"dataSourceId":"abc-123","dataSourceName":"Q4 Report.pdf","score":0.85,"type":"PDF","pages":[1,3]},{"dataSourceId":"def-456","dataSourceName":"Data.xlsx","score":0.72,"type":"XLSX","sheet":"Revenue","rows":[5],"columns":["Revenue","Quarter"]}]'
  );
  lines.push('```');
  lines.push('');
  lines.push(
    `**Pattern:** ${StreamBlock.THINKING} → tool call → ${StreamBlock.THINKING} → tool call → answer text → ${StreamBlock.SOURCES}`
  );

  return lines.join('\n');
}
