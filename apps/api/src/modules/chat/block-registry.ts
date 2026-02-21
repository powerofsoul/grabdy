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
      'Narrate your reasoning to the user in real time. The UI renders these as a collapsible "Thinking" section. This is the user\'s ONLY feedback that work is happening — without it, they stare at a blank screen. Be verbose and frequent.',
    guidelines: [
      '**Output reasoning blocks frequently** — the user is watching a live stream and needs constant feedback that work is happening. Without these blocks they see a blank screen for seconds.',
      "**BEFORE every tool call:** Explain what you're about to search for and why. Example: \"Let me search for `!CAL` command syntax in the knowledge base...\"",
      '**AFTER every tool result:** Summarize what you found — how many results, which sources matched, whether they look relevant. Example: "Found 4 results about `!CAL` in **Napa Materials** covering syntax and built-in functions. Let me also look for usage examples..."',
      '**Between searches:** If you plan to search again, explain your reasoning — what you still need, why you\'re refining the query, what angle you\'re trying next.',
      '**Before writing your answer:** Briefly state what you concluded — "I have enough information to answer. The knowledge base covers `!CAL` syntax, variable assignment, and array operations."',
      'Be specific and detailed. Name the sources, mention what topics they cover, note page ranges. "Found 3 matches in **Q4 Report.pdf** pages 12-15 covering revenue breakdown" — not just "Searching..." or "Found results."',
      'Use markdown: `backticks` for code/commands/terms, **bold** for source names and emphasis. NEVER use quotes or italics for technical terms.',
      'Do NOT disclose internal IDs, scores, or raw metadata. Speak like a helpful assistant narrating their work.',
      '**STOP reasoning blocks once you start writing your answer text.** No reasoning blocks inside or after the answer.',
      'Skip reasoning blocks entirely for greetings, acknowledgments, and messages that do not require a search.',
    ],
    example: `\`\`\`${StreamBlock.THINKING}
The user is asking about the \`!CAL\` command. Let me search the knowledge base for its documentation and syntax...
\`\`\`

[tool call]

\`\`\`${StreamBlock.THINKING}
Found 4 results about \`!CAL\` in **Napa Materials** (pages 376-813) covering the command syntax, variable assignment, and built-in math functions like \`VOL()\` and \`CG()\`. I still need concrete usage examples — let me search for those specifically...
\`\`\`

[tool call]

\`\`\`${StreamBlock.THINKING}
Got 3 more results with examples of \`!CALC var=expression\` and array operations using \`CI\` (current index). I now have enough information to give a complete answer covering syntax, assignment, and built-in functions.
\`\`\``,
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
    example: `\`\`\`${StreamBlock.SOURCES}
[{"dataSourceId":"abc-123","dataSourceName":"Q4 Report.pdf","score":0.85,"type":"PDF","pages":[1,3]},{"dataSourceId":"def-456","dataSourceName":"Sales Data.xlsx","score":0.72,"type":"XLSX","sheet":"Q4","rows":[5,12],"columns":["Revenue","Quarter"]}]
\`\`\``,
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
    lines.push(`### \`${name}\` block

Purpose: ${block.purpose}

Guidelines:
${block.guidelines.map((g) => `- ${g}`).join('\n')}

Example:
${block.example}
`);
  }

  return lines.join('\n');
}
