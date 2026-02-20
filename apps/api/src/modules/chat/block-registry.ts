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
      "Narrate your reasoning to the user in real time. The UI renders these as a collapsible \"Thinking\" section. This is the user's ONLY feedback that work is happening — without it, they stare at a blank screen. Be verbose and frequent.",
    guidelines: [
      '**MANDATORY: output thinking blocks FREQUENTLY throughout your response.** The user is watching a live stream — every few seconds without visible progress feels like the app is frozen.',
      "Output a thinking block BEFORE every tool call: say what you're searching for and why.",
      'Output a thinking block AFTER every tool result: summarize what you found, how many results, whether they look relevant.',
      'Output a thinking block BEFORE creating canvas cards: say what cards you plan to create.',
      'Aim for 3-5 thinking blocks per response. More is better than fewer — the user wants to see your thought process.',
      'Keep each block to 1-2 natural sentences. Be specific: "Found 4 results about `!CAL` in **Napa Materials**, pages 376-813" — not "Searching...".',
      'Use markdown: `backticks` for code/commands/terms, **bold** for emphasis. NEVER use quotes or italics for technical terms.',
      'Do NOT disclose internal IDs, scores, or raw metadata. Speak like a helpful assistant narrating their work: "Looking for documentation about `!CAL`...", "Found relevant sections, building a summary...".',
      'Do NOT put thinking blocks after your final answer text.',
    ],
    example: `\`\`\`${StreamBlock.THINKING}\nSearching for \`!CAL\` command documentation...\n\`\`\`\n\n[tool call]\n\n\`\`\`${StreamBlock.THINKING}\nFound several matches in **Napa Materials** covering \`!CAL\` syntax and built-in functions. Let me search for usage examples too...\n\`\`\`\n\n[tool call]\n\n\`\`\`${StreamBlock.THINKING}\nGot examples of \`!CALC var=expression\` and array operations. Creating cards for the overview and examples...\n\`\`\``,
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
  lines.push('Searching for **Q4 revenue** data in your documents...');
  lines.push('```');
  lines.push('');
  lines.push('[tool call happens here]');
  lines.push('');
  lines.push(`\`\`\`${StreamBlock.THINKING}`);
  lines.push('Found results in `Q4 Report.pdf`. Let me also search for Q3 data to compare...');
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
