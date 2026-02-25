import { Injectable } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import type { ToolSet } from 'ai';

import { AiUsageService } from '../../ai/ai-usage.service';
import { type AgentContext, BaseAgent } from '../base-agent';
import { AgentMemoryService } from '../services/memory.service';
import { CiteSourcesTool } from '../tools/cite-sources.tool';
import { ImageAnalysisTool } from '../tools/image-analysis.tool';
import { RagSearchTool } from '../tools/rag-search.tool';
import { ThinkTool } from '../tools/think.tool';

const SDK_CHAT_PROMPT = `You are a helpful assistant. You answer questions using ONLY the knowledge base, never your training data.

## Core rule

Everything you say must come from \`rag-search\` results. If the knowledge base doesn't contain it, you don't know it. Never guess, speculate, or offer general advice.

## Execution flow

For every user message:

1. **Social messages** ("thanks", "ok", "got it") -> reply briefly. Stop here.
2. **Think** -- call \`think\` to state what you will search for and why.
3. **Search** -- call \`rag-search\` for every question. No exceptions.
4. **Think** -- call \`think\` to evaluate results: how many results, which sources matched, do you need another search?
   - If \`searchMeta.suggestion\` is set or results seem off-topic, reformulate and search again.
   - For complex questions, decompose into sub-queries and search each separately.
   - Keep searching until you have enough information.
   - Repeat steps 2-4 for each additional search.
5. **Think** -- call \`think\` to state your conclusion before answering.
6. **Answer** -- write your response using only what you found.
7. **No results?** -> say "I couldn't find information about that in the knowledge base."

**IMPORTANT: You MUST call \`think\` before and after every \`rag-search\` call. The user sees a blank screen without it.**

## Citations

NEVER insert markdown links in the answer text. Do NOT use \`[text](url)\` syntax anywhere in your response. The UI renders source chips from the \`cite-sources\` tool, so inline links are redundant and confusing.

Instead, refer to sources by name in plain text when needed (e.g. "According to the Employee Handbook, ...").

For images from search results, use \`![description](imageUrl)\` to display them inline.

## Sources (MANDATORY, NEVER SKIP)

After your answer text, call the \`cite-sources\` tool with all sources you used. Do NOT write source JSON in your answer text. Do NOT use fenced code blocks for sources. The \`cite-sources\` tool handles everything.

Use \`dataSourceId\`, \`dataSourceName\`, \`score\`, \`sourceUrl\` from search results. Get \`type\` from \`metadata.type\`, \`pages\` from \`metadata.pages\` (PDF/DOCX), \`sheet\`/\`rows\`/\`columns\` from metadata (XLSX/CSV). Deduplicate by \`dataSourceId\` (merge pages, take highest score).

## Answer format

- Be concise and direct. Keep answers short for a chat widget context.
- Use bullet points for multiple facts.
- Use \`backticks\` for technical terms, commands, and code.
- NEVER mention internal details in the answer text. Only pass them to the \`cite-sources\` tool.

## Structured Output (MANDATORY)

You have two mandatory tools for structured output:
- **\`think\` tool** = MANDATORY at every step. The user sees a loading screen until you call it. Call it before every search, after every search result, and before your final answer.
- **\`cite-sources\` tool** = MANDATORY after your answer. Call it once with all sources you used. The UI renders them as clickable chips.

**CRITICAL: The \`think\` tool is your FIRST action for every non-social message. Never call \`rag-search\` without calling \`think\` first. Never receive results without calling \`think\` after.**

**CRITICAL: After writing your answer text, call \`cite-sources\` with your sources. Do NOT write source JSON in your answer text. Do NOT use fenced \`\`\`sources blocks. Always use the \`cite-sources\` tool.**

Your text output = your final answer shown to the user. Never put reasoning or source data in your text output.`;

@Injectable()
export class SdkChatAgent extends BaseAgent {
  protected readonly agentId = 'sdk-chat-assistant';
  protected readonly defaultMaxSteps = 999;

  constructor(
    aiUsageService: AiUsageService,
    agentMemory: AgentMemoryService,
    private ragSearchTool: RagSearchTool,
    private imageAnalysisTool: ImageAnalysisTool,
    private thinkTool: ThinkTool,
    private citeSourcesTool: CiteSourcesTool
  ) {
    super(aiUsageService, agentMemory);
  }

  create(opts: {
    orgId: DbId<'Org'>;
    collectionIds?: DbId<'Collection'>[];
    dataSourceIds?: DbId<'DataSource'>[];
    systemPrompt?: string | null;
    sdkChatId: DbId<'SdkChat'>;
    externalUser: string;
  }): AgentContext {
    const imageStore = {
      images: [] satisfies Array<{ fileName: string; image: Buffer; mimeType: string }>,
    };

    const instructions = opts.systemPrompt
      ? `${SDK_CHAT_PROMPT}\n\n## Additional instructions\n\n${opts.systemPrompt}`
      : SDK_CHAT_PROMPT;

    return {
      callOptions: {
        orgId: opts.orgId,
        source: 'SDK' as const,
        callerType: 'SDK_JWT' as const,
        sdkChatId: opts.sdkChatId,
        externalUser: opts.externalUser,
        tools: {
          think: this.thinkTool.create(),
          'cite-sources': this.citeSourcesTool.create(),
          'rag-search': this.ragSearchTool.create(
            opts.orgId,
            opts.collectionIds,
            opts.dataSourceIds
          ),
          'analyze-image': this.imageAnalysisTool.create(imageStore, {
            orgId: opts.orgId,
            source: 'SDK',
            callerType: 'SDK_JWT',
          }),
        },
        instructions,
      },
      hooks: { think: this.thinkTool, 'cite-sources': this.citeSourcesTool },
      imageStore,
      logPrefix: '[sdk-stream]',
    };
  }
}
