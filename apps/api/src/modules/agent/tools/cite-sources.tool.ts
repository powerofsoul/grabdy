import { Injectable } from '@nestjs/common';

import { tool } from 'ai';
import { z } from 'zod';

import type { Tool } from '../base-tool';

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
 * GPT models output either text or tool calls per turn, so emitting a fenced
 * sources block inline doesn't work reliably. This tool captures the sources
 * as structured data and the stream processor emits the fenced block.
 */
@Injectable()
export class CiteSourcesTool implements Tool {
  create() {
    return tool({
      description:
        'MANDATORY: Call this tool ONCE after writing your answer to cite your sources. ' +
        'Pass all sources you used from rag-search results. ' +
        'The UI renders these as clickable source chips. ' +
        'Deduplicate by dataSourceId (merge pages, take highest score). ' +
        'Do NOT write a ```sources block in your text. Use this tool instead. ' +
        'Do NOT embed source JSON in your answer text. ' +
        'Skip this tool only for greetings/social messages where no sources were used.',
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

  onToolCall(input: unknown): string | null {
    if (input && typeof input === 'object' && 'sources' in input) {
      const sources = input.sources;
      if (Array.isArray(sources) && sources.length > 0) {
        return `\n\`\`\`sources\n${JSON.stringify(sources)}\n\`\`\`\n`;
      }
    }
    return null;
  }
}
