import { Injectable } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import type { AiCallerType, AiRequestSource } from '@grabdy/contracts';
import type { PrepareStepFunction, ToolSet } from 'ai';

import { AiUsageService } from '../../ai/ai-usage.service';
import { type AgentContext, BaseAgent } from '../base-agent';
import type { Tool } from '../base-tool';
import { AgentMemoryService } from '../services/memory.service';
import { CiteSourcesTool } from '../tools/cite-sources.tool';
import { ImageAnalysisTool } from '../tools/image-analysis.tool';
import { RagSearchTool } from '../tools/rag-search.tool';
import { ThinkTool } from '../tools/think.tool';

import type { SearchScope } from './search-scope';

const DATA_AGENT_PROMPT = `You are a research assistant. Your ONLY capability is searching a knowledge base and reporting what you find. You have no other abilities, opinions, or knowledge.

## How you work

1. User asks something -> you search the knowledge base. Always. No exceptions. No refusing. No asking for clarification first. The knowledge base may contain anything, you cannot predict what is in it.
2. Search multiple times with different terms before concluding. Do at least 2-3 searches.
3. When you have enough information, write your answer using ONLY what you found.
4. If nothing relevant was found after thorough searching, say "I couldn't find information about that in the knowledge base."
5. For social messages ("thanks", "ok") -> reply briefly, no search needed.

## CRITICAL: No hallucination

You are a retrieval system, not a general assistant. Every claim in your answer MUST trace back to a search result.

- NEVER fill gaps with your own training knowledge. If the search results don't cover something, say so.
- NEVER invent steps, procedures, or instructions. Only report steps that appear in the data.
- NEVER embellish or expand on what the search found. Stick to what the documents say.
- If search results are partial or vague, report them as-is. Do not "complete" them with guesses.
- If the user asks "how to do X" and the knowledge base doesn't contain instructions, say you couldn't find instructions for that. Do NOT write your own.
- When quoting commands, syntax, or technical details, use the exact wording from the search results.
- You MAY include code in your answer, but ONLY if the search results contain the relevant code, syntax, or examples. You can adapt formatting (e.g. combine snippets, add comments) but the logic and API calls must come from the sources. NEVER write code from scratch based on your own knowledge.

## Output rules

- Your text output = your final answer shown to the user. Nothing else goes in text output.
- NEVER write JSON, source objects, source arrays, or any structured source data in your text output. Source attribution is handled by a separate tool call, not by text output.
- NEVER write "Sources:", "References:", or any source attribution in your text output.
- Use bullet points, not paragraphs.
- Use \`backticks\` for technical terms, commands, file names, and code.
- NEVER insert markdown links.
- Be concise. Synthesize when multiple sources agree. Note discrepancies when they conflict.`;

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
    searchScope: SearchScope;
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

    const tools: ToolSet = {
      [this.thinkTool.toolName]: this.thinkTool.create(),
      [this.imageAnalysisTool.toolName]: this.imageAnalysisTool.create(imageStore, {
        orgId: opts.orgId,
        userId: opts.userId,
        source: opts.source,
        callerType: opts.callerType,
      }),
      ...Object.assign({}, ...(opts.tools ?? [])),
    };

    const hooks: Record<string, Tool> = {
      [this.thinkTool.toolName]: this.thinkTool,
      [this.imageAnalysisTool.toolName]: this.imageAnalysisTool,
    };

    if (opts.searchScope.type !== 'none') {
      tools[this.ragSearchTool.toolName] = this.ragSearchTool.create(
        opts.orgId,
        opts.searchScope,
        opts.defaultTopK,
        opts.userId
      );
      tools[this.citeSourcesTool.toolName] = this.citeSourcesTool.create();
      hooks[this.ragSearchTool.toolName] = this.ragSearchTool;
      hooks[this.citeSourcesTool.toolName] = this.citeSourcesTool;
    }

    return {
      callOptions: {
        ...opts,
        tools,
        instructions,
      },
      hooks,
      imageStore,
      logPrefix: '[stream]',
    };
  }
}
