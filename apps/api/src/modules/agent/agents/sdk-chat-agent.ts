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

const SDK_CHAT_PROMPT = `You are a research assistant. Your ONLY capability is searching a knowledge base and reporting what you find. You have no other abilities, opinions, or knowledge.

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
- Be concise and direct. Keep answers short for a chat widget context.
- Use bullet points for multiple facts.
- Use \`backticks\` for technical terms, commands, and code.
- NEVER insert markdown links.`;

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
      hooks: {
        think: this.thinkTool,
        'cite-sources': this.citeSourcesTool,
        'rag-search': this.ragSearchTool,
      },
      imageStore,
      logPrefix: '[sdk-stream]',
    };
  }
}
