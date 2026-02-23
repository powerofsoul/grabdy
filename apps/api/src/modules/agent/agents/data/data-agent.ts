import { Injectable } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import type { AiCallerType, AiRequestSource } from '@grabdy/contracts';
import type { PrepareStepFunction, ToolSet } from 'ai';

import { AiUsageService } from '../../../ai/ai-usage.service';
import { BaseAgent } from '../../base-agent';
import { AgentMemoryService } from '../../services/memory.service';
import { RagSearchTool } from '../../tools/rag-search.tool';

import { DataAgentSession } from './data-agent-session';

const DATA_AGENT_PROMPT = `You are a data assistant. You answer questions using ONLY the knowledge base, never your training data.

## Core rule

Everything you say must come from \`rag-search\` results. If the knowledge base doesn't contain it, you don't know it. Never guess, speculate, offer general advice, or suggest meanings not found in results.

## Execution flow

For every user message:

1. **Social messages** ("thanks", "ok", "got it") -> reply with one short sentence (e.g. "Happy to help."). Stop here.
2. **Search** -- call \`rag-search\` for every question, follow-up, or topic. No exceptions.
3. **Evaluate results** -- read the content and judge whether it answers the question. Ignore numeric scores.
   - If \`searchMeta.suggestion\` is set or results seem off-topic, reformulate and search again with different terms.
   - For complex questions, decompose into 2-3 sub-queries and search each separately ("compare X and Y" -> search X, then Y).
   - When results mention related concepts, do a follow-up search for those.
   - Keep searching until you have enough information. Do not stop after one call.
4. **Answer** -- write your response using only what you found.
5. **No results?** -> say "I couldn't find information about that in the knowledge base." Nothing more.

## Answer format

- Use bullet points, not paragraphs. Each fact gets its own bullet.
- Use \`backticks\` for all technical terms, commands, functions, file names, and code. Never use italics for technical terms.
- Be concise, cover what was asked, don't add unrequested context.
- Synthesize when multiple sources agree. Note discrepancies when they conflict.
- Never include page numbers, dataSourceIds, chunk IDs, or other internal metadata in your answer text.`;

@Injectable()
export class DataAgent extends BaseAgent {
  protected readonly agentId = 'data-assistant';
  protected readonly defaultMaxSteps = 999;

  constructor(
    aiUsageService: AiUsageService,
    private ragSearchTool: RagSearchTool,
    private agentMemory: AgentMemoryService
  ) {
    super(aiUsageService);
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
  }): DataAgentSession {
    const ragTool = this.ragSearchTool.create(
      opts.orgId,
      opts.collectionIds,
      opts.defaultTopK,
      opts.userId
    );

    const tools: ToolSet = {
      'rag-search': ragTool,
      ...Object.assign({}, ...(opts.tools ?? [])),
    };

    const instructions = opts.instructions
      ? `${DATA_AGENT_PROMPT}\n\n${opts.instructions}`
      : DATA_AGENT_PROMPT;

    const agent = this.buildAgent({
      ...opts,
      tools,
      instructions,
    });

    return new DataAgentSession(agent, this.agentMemory, opts.orgId);
  }
}
