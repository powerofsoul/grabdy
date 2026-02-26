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

const DATA_AGENT_PROMPT = `You are a research assistant. Your ONLY capability is searching a knowledge base and reporting what you find. You have no other abilities, opinions, or knowledge.

## How you work

1. User asks something -> you search the knowledge base. Always. No exceptions. No refusing. No asking for clarification first. The knowledge base may contain anything, you cannot predict what is in it.
2. Search multiple times with different terms before concluding. Do at least 2-3 searches.
3. When you have enough information, write your answer using ONLY what you found.
4. If nothing relevant was found after thorough searching, say "I couldn't find information about that in the knowledge base."
5. For social messages ("thanks", "ok") -> reply briefly, no search needed.

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
    collectionIds?: DbId<'Collection'>[];
    dataSourceIds?: DbId<'DataSource'>[];
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
            opts.dataSourceIds,
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
      hooks: {
        think: this.thinkTool,
        'cite-sources': this.citeSourcesTool,
        'rag-search': this.ragSearchTool,
      },
      imageStore,
      logPrefix: '[stream]',
    };
  }
}
