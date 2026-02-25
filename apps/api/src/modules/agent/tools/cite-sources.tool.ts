import { Injectable } from '@nestjs/common';

import { tool } from 'ai';
import { z } from 'zod';

import type { StreamChunk, Tool } from '../base-tool';

const sourceSchema = z.object({
  type: z
    .string()
    .describe(
      'File type from metadata.type: PDF, DOCX, XLSX, CSV, TXT, JSON, IMAGE, SLACK, LINEAR, GITHUB, NOTION'
    ),
  dataSourceId: z.string().describe('The dataSourceId from the search result'),
  dataSourceName: z.string().describe('The dataSourceName from the search result'),
  score: z.number().describe('The relevance score from the search result'),
  sourceUrl: z.string().describe('The sourceUrl from the search result'),
  pages: z.array(z.number()).optional().describe('Page numbers for PDF/DOCX sources'),
  sheet: z.string().optional().describe('Sheet name for XLSX sources'),
  rows: z.array(z.number()).optional().describe('Row numbers for XLSX/CSV sources'),
  columns: z.array(z.string()).optional().describe('Column names for XLSX/CSV sources'),
});

/**
 * A "cite-sources" tool that lets the model report which sources it used.
 * Captures sources as structured data and emits a typed StreamChunk
 * for the UI to render as clickable chips.
 */
@Injectable()
export class CiteSourcesTool implements Tool {
  systemPrompt = `## Citing sources (MANDATORY)

If you used ANY information from \`rag-search\` results in your answer, you MUST call \`cite-sources\`. No exceptions. Every fact you state came from a source, so cite it. Skipping citations is only acceptable for greetings or social messages where no search was performed.

Call \`cite-sources\` ONCE after writing your answer. Include every source whose content contributed to your answer. The UI renders these as clickable chips so the user can verify your claims.

**How to cite:** Refer to sources by name in your answer text (e.g. "According to the Employee Handbook, ..."). Then pass the structured data to \`cite-sources\`. Deduplicate by \`dataSourceId\` (merge pages, take highest score).

### CRITICAL: source data NEVER goes in text output

Your text output is rendered directly to the user as your answer. Source attribution is handled by a separate UI component that reads from the \`cite-sources\` tool call.

If you write source data in your text output, it will appear as ugly raw JSON to the user. This is a bug. The ONLY correct way to cite sources is via the \`cite-sources\` tool call.

Forbidden in text output:
- JSON objects or arrays containing source data
- \`{ "sources": [...] }\` blocks
- \`dataSourceId\`, \`dataSourceName\`, \`score\`, \`sourceUrl\` fields
- "Sources:", "References:", "Citations:" headers followed by source listings
- Raw URLs from search results
- Any mention of scores, IDs, or internal metadata

Your text = the answer in plain language. Source data = \`cite-sources\` tool call. No overlap.`;

  create() {
    return tool({
      description:
        'MANDATORY after every answer that used rag-search results. ' +
        'If you searched and found information, you MUST call this tool. ' +
        'Pass all sources you referenced. Deduplicate by dataSourceId (merge pages, take highest score). ' +
        'The UI renders these as clickable source chips so users can verify your answer.',
      inputSchema: z.object({
        sources: z
          .array(sourceSchema)
          .describe('Array of source objects from search results that you used in your answer'),
      }),
      execute: async () => {
        return { ok: true };
      },
    });
  }

  onToolCall(input: unknown): StreamChunk | null {
    if (input && typeof input === 'object' && 'sources' in input) {
      const sources = input.sources;
      if (Array.isArray(sources) && sources.length > 0) {
        return { type: 'sources', sources };
      }
    }
    return null;
  }
}
