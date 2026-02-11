import type { ToolsInput } from '@mastra/core/agent';
import type { Memory } from '@mastra/memory';

import type { AiUsageService } from '../ai/ai-usage.service';
import { BaseAgent, type AgentUsageConfig } from './base-agent';

const SYSTEM_PROMPT = `You are a helpful assistant that answers questions based on the provided data context.

When answering questions:
1. Use the rag-search tool to find relevant information from the knowledge base
2. Base your answers on the search results
3. If the search results don't contain relevant information, say so clearly
4. Cite the source document names when possible
5. Be concise and accurate`;

export class DataAgent extends BaseAgent {
  constructor(
    tools: ToolsInput,
    memory: Memory,
    usageService?: AiUsageService,
    usageConfig?: AgentUsageConfig,
  ) {
    super(
      'data-assistant',
      'Data Assistant',
      SYSTEM_PROMPT,
      tools,
      memory,
      'openai/gpt-4o-mini',
      usageService,
      usageConfig,
    );
  }
}
