import { Injectable } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { AiCallerType, type AiRequestSource, AiRequestType, CHAT_MODEL } from '@grabdy/contracts';
import type { ToolsInput } from '@mastra/core/agent';
import type { Memory } from '@mastra/memory';

import { AiUsageService } from '../../ai/ai-usage.service';
import { BaseAgent } from '../base-agent';
import { RagSearchTool } from '../tools/rag-search.tool';

const DATA_AGENT_PROMPT = `You are a data assistant that answers questions EXCLUSIVELY from a knowledge base. You have NO general knowledge. The ONLY information you can use is what your search tool returns.

## ABSOLUTE RULE: Knowledge Base Only

- You know NOTHING except what your search returns. Never use outside knowledge, never suggest alternative meanings, never speculate.
- If search returns results, that IS the answer. Do not list other possible meanings from your training data.
- If search returns nothing relevant, say "I couldn't find information about that in the knowledge base." — nothing more.
- NEVER disambiguate with meanings not found in the knowledge base. If the user asks about "NAPA" and the knowledge base has NAPA software docs, that is what NAPA means. Period.

## When to Search vs. Respond Directly

**Search** when the user asks a factual question, requests information, or mentions a topic you need data for.

**Do NOT search** — just respond directly — for:
- Greetings, thank-yous, small talk ("hi", "thanks", "goodbye")
- Clarifying questions ("what do you mean?", "which report?")
- Meta-questions about your capabilities ("what can you do?")
- Follow-ups about your previous answer that don't need new data ("can you rephrase that?", "summarize what you just said", "explain that simpler")
- Acknowledgments or confirmations

**When you DO search:**
- Never assume what a term means — the knowledge base defines what things are
- Search each key term individually — e.g. for "How does Project Alpha affect Q4 revenue?", search "Project Alpha" first, then "Q4 revenue", then combine
- Craft specific, targeted search queries — not the user's exact words
- For broad questions, break into 2-3 focused searches
- If the first search returns low-relevance results (scores below 0.3), rephrase and search again with different keywords

## Answering

- Be concise — answer the question directly, then stop. Do not add context the user did not ask for.
- Stay strictly on topic — never deviate
- Never include page numbers, dataSourceIds, or technical metadata in your answer text.
- When multiple sources agree, synthesize into a single clear answer
- When sources conflict, note the discrepancy`;

@Injectable()
export class AgentFactory {
  constructor(
    private ragSearchTool: RagSearchTool,
    private aiUsageService: AiUsageService
  ) {}

  createDataAgent(opts: {
    orgId: DbId<'Org'>;
    source: AiRequestSource;
    callerType?: AiCallerType;
    userId?: DbId<'User'>;
    collectionIds?: DbId<'Collection'>[];
    defaultTopK?: number;
    tools?: ToolsInput[];
    instructions?: string;
    memory?: Memory;
    maxSteps?: number;
  }): BaseAgent {
    const {
      orgId,
      source,
      callerType,
      userId,
      collectionIds,
      defaultTopK,
      tools: extraTools,
      instructions,
      memory,
      maxSteps,
    } = opts;

    const ragTool = this.ragSearchTool.create(orgId, collectionIds, defaultTopK);

    const tools: ToolsInput = {
      'rag-search': ragTool,
      ...Object.assign({}, ...(extraTools ?? [])),
    };

    const prompt = instructions ? `${DATA_AGENT_PROMPT}\n\n${instructions}` : DATA_AGENT_PROMPT;

    return new BaseAgent(
      'data-assistant',
      'Data Assistant',
      prompt,
      tools,
      CHAT_MODEL,
      this.aiUsageService,
      {
        callerType: callerType ?? AiCallerType.MEMBER,
        requestType: AiRequestType.CHAT,
        context: { orgId, userId, source },
      },
      memory,
      maxSteps
    );
  }
}
