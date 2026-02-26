import { Injectable } from '@nestjs/common';

import type { StreamChunk } from '@grabdy/contracts';
import { chatSourceSchema } from '@grabdy/contracts';
import { tool } from 'ai';
import { z } from 'zod';

import type { Tool, ToolCallContext } from '../base-tool';

import { RagSearchTool } from './rag-search.tool';

const inputSchema = z.object({
  sources: z
    .array(chatSourceSchema)
    .describe('Array of source objects from search results that you used in your answer'),
});

type Input = z.infer<typeof inputSchema>;
type Output = { ok: boolean };

@Injectable()
export class CiteSourcesTool implements Tool<Input, Output> {
  readonly toolName = 'cite-sources' as const;

  systemPrompt = `## Citing sources (MANDATORY)

If you used ANY information from \`rag-search\` results, you MUST call \`cite-sources\` ONCE after your answer. Only include sources you actually used, not all search results. Deduplicate by \`dataSourceId\` (merge pages, take highest score). Skip only for greetings or social messages where no search was performed.

### CRITICAL: NO source references in text output

The UI renders source attribution automatically from the \`cite-sources\` tool call as clickable chips. Your text output must contain ZERO source references of any kind.

Forbidden in text output:
- File names in brackets: \`[Document.pdf]\`, \`[file-name.docx]\`
- Inline citations: \`(Source: ...)\`, \`[1]\`, \`[Source]\`
- "According to [document name]" or "Based on [source]"
- "Sources:", "References:", "Citations:" headers
- \`dataSourceId\`, \`dataSourceName\`, \`score\`, \`sourceUrl\` fields
- JSON objects, arrays, or raw URLs from search results

Your text = the answer in plain language with no attribution. Source data = \`cite-sources\` tool call only.`;

  create() {
    return tool({
      description:
        'MANDATORY after every answer that used rag-search results. ' +
        'If you searched and found information, you MUST call this tool. ' +
        'Only include sources whose content you actually referenced in your answer, not every result from rag-search. ' +
        'Deduplicate by dataSourceId (merge pages, take highest score). ' +
        'The UI renders these as clickable source chips so users can verify your answer.',
      inputSchema,
      execute: async () => {
        return { ok: true };
      },
    });
  }

  onToolCall(ctx: ToolCallContext<Input>): StreamChunk | null {
    if (ctx.input.sources.length === 0) return null;
    return { type: 'sources', sources: ctx.input.sources };
  }

  mustBeCalled(calledToolNames: Set<string>): boolean {
    return calledToolNames.has(RagSearchTool.TOOL_NAME);
  }
}
