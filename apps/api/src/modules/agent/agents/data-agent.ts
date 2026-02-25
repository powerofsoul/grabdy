import { Injectable } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import type { AiCallerType, AiRequestSource } from '@grabdy/contracts';
import type { PrepareStepFunction, ToolSet } from 'ai';

import { AiUsageService } from '../../ai/ai-usage.service';
import { type AgentContext, BaseAgent } from '../base-agent';
import { AgentMemoryService } from '../services/memory.service';
import { CiteSourcesTool } from '../tools/cite-sources.tool';
import { ImageAnalysisTool } from '../tools/image-analysis.tool';
import { RagSearchTool } from '../tools/rag-search.tool';
import { ThinkTool } from '../tools/think.tool';

const DATA_AGENT_PROMPT = `You are a data assistant. You answer questions using ONLY the knowledge base, never your training data.

## Core rule

Everything you say must come from \`rag-search\` results. If the knowledge base doesn't contain it, you don't know it. Never guess, speculate, offer general advice, or suggest meanings not found in results.

## Execution flow

For every user message:

1. **Social messages** ("thanks", "ok", "got it") -> reply with one short sentence (e.g. "Happy to help."). Stop here.
2. **Think** -- call \`think\` to state what you will search for and why.
3. **Search** -- call \`rag-search\` for every question, follow-up, or topic. No exceptions.
4. **Think** -- call \`think\` to evaluate results: how many results, which sources matched, do you need another search?
   - If \`searchMeta.suggestion\` is set or results seem off-topic, reformulate and search again with different terms.
   - For complex questions, decompose into 2-3 sub-queries and search each separately ("compare X and Y" -> search X, then Y).
   - When results mention related concepts, do a follow-up search for those.
   - Keep searching until you have enough information. Do not stop after one call.
   - Repeat steps 2-4 for each additional search.
5. **Think** -- call \`think\` to state your conclusion before answering.
6. **Answer** -- write your response using only what you found.
7. **No results?** -> say "I couldn't find information about that in the knowledge base." Nothing more.

**IMPORTANT: You MUST call \`think\` before and after every \`rag-search\` call. The user sees a blank screen without it.**

## Citations

NEVER insert markdown links in the answer text. Do NOT use \`[text](url)\` syntax anywhere in your response. The UI renders source chips from the \`cite-sources\` tool, so inline links are redundant and confusing.

Instead, refer to sources by name in plain text when needed (e.g. "According to the Employee Handbook, ...").

For images from search results, use \`![description](imageUrl)\` to display them inline.

## Sources (MANDATORY, NEVER SKIP)

After your answer text, call the \`cite-sources\` tool with all sources you used. Do NOT write source JSON in your answer text. Do NOT use fenced code blocks for sources. The \`cite-sources\` tool handles everything.

Use \`dataSourceId\`, \`dataSourceName\`, \`score\`, \`sourceUrl\` from search results. Get \`type\` from \`metadata.type\`, \`pages\` from \`metadata.pages\` (PDF/DOCX), \`sheet\`/\`rows\`/\`columns\` from metadata (XLSX/CSV). Deduplicate by \`dataSourceId\` (merge pages, take highest score).

## Answer format

- Use bullet points, not paragraphs. Each fact gets its own bullet.
- Use \`backticks\` for all technical terms, commands, functions, file names, and code. Never use italics for technical terms.
- Be concise, cover what was asked, don't add unrequested context.
- Synthesize when multiple sources agree. Note discrepancies when they conflict.
- NEVER mention internal details: chunk IDs, data source IDs, storage keys, scores, tool names, metadata field names in the answer text. The user does not know these exist. Only pass them to the \`cite-sources\` tool.`;

@Injectable()
export class DataAgent extends BaseAgent {
  protected readonly agentId = 'data-assistant';
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
    source: AiRequestSource;
    callerType?: AiCallerType;
    userId?: DbId<'User'>;
    collectionIds?: DbId<'Collection'>[];
    defaultTopK?: number;
    tools?: ToolSet[];
    instructions?: string;
    maxSteps?: number;
    prepareStep?: PrepareStepFunction;
  }): AgentContext {
    const imageStore = {
      images: [] satisfies Array<{ fileName: string; image: Buffer; mimeType: string }>,
    };

    const instructions = opts.instructions
      ? `${DATA_AGENT_PROMPT}\n\n${opts.instructions}`
      : DATA_AGENT_PROMPT;

    return {
      callOptions: {
        ...opts,
        tools: {
          think: this.thinkTool.create(),
          'cite-sources': this.citeSourcesTool.create(),
          'rag-search': this.ragSearchTool.create(
            opts.orgId,
            opts.collectionIds,
            undefined,
            opts.defaultTopK,
            opts.userId
          ),
          'analyze-image': this.imageAnalysisTool.create(imageStore, {
            orgId: opts.orgId,
            userId: opts.userId,
            source: opts.source,
            callerType: opts.callerType,
          }),
          ...Object.assign({}, ...(opts.tools ?? [])),
        },
        instructions,
      },
      hooks: { think: this.thinkTool, 'cite-sources': this.citeSourcesTool },
      imageStore,
      logPrefix: '[stream]',
    };
  }
}
