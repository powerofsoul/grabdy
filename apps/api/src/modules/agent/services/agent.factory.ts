import { Injectable } from '@nestjs/common';

import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import type { DbId } from '@grabdy/common';
import { AiCallerType, type AiRequestSource, AiRequestType, CHAT_MODEL } from '@grabdy/contracts';
import type { ToolsInput } from '@mastra/core/agent';
import type { Memory } from '@mastra/memory';

import { AiUsageService } from '../../ai/ai-usage.service';
import { BaseAgent } from '../base-agent';
import { RagSearchTool } from '../tools/rag-search.tool';

const awsCredentials = fromNodeProviderChain();
const bedrockProvider = createAmazonBedrock({
  credentialProvider: async () => {
    const creds = await awsCredentials();
    return {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    };
  },
});
const CHAT_LANGUAGE_MODEL = bedrockProvider(CHAT_MODEL.replace('amazon-bedrock/', ''));

const DATA_AGENT_PROMPT = `You are a data assistant. You answer questions using ONLY the knowledge base — never your training data.

## Core rule

Everything you say must come from \`rag-search\` results. If the knowledge base doesn't contain it, you don't know it. Never guess, speculate, offer general advice, or suggest meanings not found in results.

## Execution flow

For every user message:

1. **Social messages** ("thanks", "ok", "got it") → reply with one short sentence (e.g. "Happy to help."). Stop here.
2. **Search** — call \`rag-search\` for every question, follow-up, or topic. No exceptions.
3. **Evaluate results** — read the content and judge whether it answers the question. Ignore numeric scores.
   - If \`searchMeta.suggestion\` is set or results seem off-topic, reformulate and search again with different terms.
   - For complex questions, decompose into 2–3 sub-queries and search each separately ("compare X and Y" → search X, then Y).
   - When results mention related concepts, do a follow-up search for those.
   - Keep searching until you have enough information. Do not stop after one call.
4. **Answer** — write your response using only what you found.
5. **No results?** → say "I couldn't find information about that in the knowledge base." Nothing more.

## Answer format

- Use bullet points, not paragraphs. Each fact gets its own bullet.
- Use \`backticks\` for all technical terms, commands, functions, file names, and code. Never use italics for technical terms.
- Be concise — cover what was asked, don't add unrequested context.
- Synthesize when multiple sources agree. Note discrepancies when they conflict.
- Never include page numbers, dataSourceIds, chunk IDs, or other internal metadata in your answer text.`;

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

    const ragTool = this.ragSearchTool.create(orgId, collectionIds, defaultTopK, userId);

    const tools: ToolsInput = {
      'rag-search': ragTool,
      ...Object.assign({}, ...(extraTools ?? [])),
    };

    const promptText = instructions ? `${DATA_AGENT_PROMPT}\n\n${instructions}` : DATA_AGENT_PROMPT;

    return new BaseAgent(
      'data-assistant',
      'Data Assistant',
      promptText,
      tools,
      CHAT_MODEL,
      this.aiUsageService,
      {
        callerType: callerType ?? AiCallerType.MEMBER,
        requestType: AiRequestType.CHAT,
        context: { orgId, userId, source },
      },
      memory,
      maxSteps,
      CHAT_LANGUAGE_MODEL
    );
  }
}
