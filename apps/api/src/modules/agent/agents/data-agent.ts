import { Injectable } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import type { AiCallerType, AiRequestSource } from '@grabdy/contracts';
import type { PrepareStepFunction, ToolSet } from 'ai';

import { AiUsageService } from '../../ai/ai-usage.service';
import { type AgentContext, BaseAgent } from '../base-agent';
import type { Tool } from '../base-tool';
import { AgentMemoryService } from '../services/memory.service';
import { ImageAnalysisTool } from '../tools/image-analysis.tool';
import { ListSourcesTool } from '../tools/list-sources.tool';
import { RagSearchTool } from '../tools/rag-search.tool';
import { ThinkTool } from '../tools/think.tool';

import type { SearchScope } from './search-scope';

const DATA_AGENT_PROMPT = `You are a research assistant. You search a knowledge base and report what you find. You have no other knowledge.

## How you work

1. User asks something -> search the knowledge base. Always. No exceptions.
2. Search again with different terms only if results are insufficient or off-topic.
3. Answer using ONLY what you found. If nothing relevant was found, say so.
4. For social messages ("thanks", "ok") -> reply briefly, no search needed.

## No hallucination

Every claim MUST trace back to a search result.

- NEVER fill gaps with training knowledge. If results don't cover something, say so.
- NEVER invent steps or procedures. Only report what the documents say.
- Report partial or vague results as-is. Do not "complete" them with guesses.
- Code is allowed ONLY if the search results contain the relevant code or syntax.

## Output rules

- Text output = your final answer.
- NEVER write "Sources:" headers, file names, or raw source references in text.
- Use the right format for the content: bullets for lists, numbered lists for steps/procedures, short prose for single facts.
- Use \`backticks\` for technical terms, commands, and code.
- ALWAYS include images from search results. If a result has a non-null \`imageUrl\`, embed it with markdown \`![description](URL)\` where URL is the actual imageUrl value from the result. Images are diagrams, screenshots, or figures extracted from documents. Never skip them.
- Be concise. Synthesize when sources agree, note discrepancies when they conflict.

## Inline source citations (MANDATORY)

Cite sources inline using EXACTLY this syntax: \`{{1}}\`, \`{{2}}\`, etc. Use double curly braces and nothing else. NEVER use square brackets, fullwidth brackets 【】, footnotes, or any other citation format.

CORRECT: The function creates a segment {{1}}. For curves, use bezier {{2}}.
WRONG: The function creates a segment [1]. (do NOT use this)
WRONG: The function creates a segment 【1】. (do NOT use this)

Place each marker right after the sentence or fact it supports. Reuse the same number when the same source supports multiple claims.

NEVER place citation markers inside code blocks, JSON, inline \`code\`, URLs, or any structured/formatted content. Citations go in the prose text surrounding the code, not inside it. Putting citations inside code breaks parsing.

After your answer, add a fenced \`sources\` code block with the full source data as a JSON array:

\`\`\`sources
[{"ref":1,"dataSourceId":"...","dataSourceName":"...","type":"PDF","sourceUrl":"...","score":0.9,"content":"brief excerpt","pages":[5]},{"ref":2,"dataSourceId":"...","dataSourceName":"...","type":"TXT","sourceUrl":null,"score":0.8,"content":"brief excerpt"}]
\`\`\`

Rules:
- The \`ref\` number in JSON must match the inline citation numbers.
- Copy \`dataSourceId\`, \`dataSourceName\`, \`type\`, \`sourceUrl\`, \`score\` exactly from search results.
- Include type-specific fields: \`pages\` for PDF/DOCX, \`sheet\`/\`rows\`/\`columns\` for XLSX/CSV. Aggregate \`row\` values into a \`rows\` array when citing multiple chunks from the same source.
- Set \`content\` to a verbatim 1-2 sentence quote copied directly from the search result. Do NOT paraphrase or summarize. Use the exact original text.
- Deduplicate by \`dataSourceId\`. Only include sources you actually cited inline.
- Skip this block only for greetings where no search was done.`;

@Injectable()
export class DataAgent extends BaseAgent {
  protected readonly agentId = 'data-assistant';
  protected readonly defaultMaxSteps = 100;

  constructor(
    aiUsageService: AiUsageService,
    agentMemory: AgentMemoryService,
    private ragSearchTool: RagSearchTool,
    private imageAnalysisTool: ImageAnalysisTool,
    private thinkTool: ThinkTool,
    private listSourcesTool: ListSourcesTool
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
      hooks[this.ragSearchTool.toolName] = this.ragSearchTool;

      tools[this.listSourcesTool.toolName] = this.listSourcesTool.create(
        opts.orgId,
        opts.searchScope
      );
      hooks[this.listSourcesTool.toolName] = this.listSourcesTool;
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
