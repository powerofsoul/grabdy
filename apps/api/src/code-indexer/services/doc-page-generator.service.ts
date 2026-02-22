import { Injectable, Logger } from '@nestjs/common';

import { AiCallerType, AiRequestType, CODE_ANALYSIS_MODEL } from '@grabdy/contracts';
import { generateText, type LanguageModel } from 'ai';

import { InjectEnv } from '../../config/env.config';
import { AiUsageService, type UsageContext } from '../../modules/ai/ai-usage.service';
import { createBedrockModel } from '../bedrock-model';

import type { DocPlanPage } from './doc-planner.service';

interface PageGenerationInput {
  planPage: DocPlanPage;
  relevantSourceCode: Array<{ path: string; content: string; summary: string }>;
  siblingPages: Array<{ title: string; slug: string; description: string }>;
  repoFullName: string;
  currentContent?: string;
  sourceDiff?: string;
}

@Injectable()
export class DocPageGeneratorService {
  private readonly logger = new Logger(DocPageGeneratorService.name);
  private readonly model: LanguageModel;

  constructor(
    @InjectEnv('codeAnalysisModel') model: string,
    @InjectEnv('awsRegion') region: string,
    private aiUsageService: AiUsageService
  ) {
    this.model = createBedrockModel(region, model);
  }

  async generatePage(input: PageGenerationInput, context: UsageContext): Promise<string> {
    const { planPage, relevantSourceCode, siblingPages, repoFullName, currentContent, sourceDiff } =
      input;

    const sourceCodeSection = relevantSourceCode
      .map((file) => {
        const truncated =
          file.content.length > 8000
            ? file.content.slice(0, 8000) + '\n... (truncated)'
            : file.content;
        return `### ${file.path}\nSummary: ${file.summary}\n\`\`\`\n${truncated}\n\`\`\``;
      })
      .join('\n\n');

    const siblingSection =
      siblingPages.length > 0
        ? `\nRelated documentation pages (for cross-referencing):\n${siblingPages.map((p) => `- [${p.title}](${p.slug}): ${p.description}`).join('\n')}`
        : '';

    const currentContentSection = currentContent
      ? `\n## Current Documentation\n\nBelow is the current version of this page. Use it as a starting point. Preserve sections that are still accurate and only update parts affected by the source code changes.\n\n${currentContent}`
      : '';

    const diffSection = sourceDiff
      ? `\n## Source Code Changes (git diff)\n\nThe following diff shows exactly what changed in the source code. Use this to understand which parts of the documentation need updating. Lines starting with + are additions, lines starting with - are deletions.\n\n\`\`\`diff\n${sourceDiff}\n\`\`\``
      : '';

    const prompt = `You are a technical documentation writer. ${currentContent ? 'Update' : 'Generate'} a documentation page for the repository "${repoFullName}".

Page: "${planPage.title}"
Description: ${planPage.description}
Content Guidelines: ${planPage.contentGuidelines}
${siblingSection}
${currentContentSection}
${diffSection}

Source code for this page:
${sourceCodeSection}

${currentContent ? 'Update the existing documentation to reflect the source code changes. Keep sections that are still accurate, update sections affected by changes, and add new sections if needed.' : 'Write a comprehensive markdown documentation page.'} Follow these rules:
- Start with a brief introduction (no need for a top-level heading, the title is added separately)
- Use ## for major sections and ### for subsections
- NEVER manually number headings (e.g. "1. Upload", "1.1 Client-side upload"). Use plain headings without numbering.
- NEVER write inline arrow chains like "A -> B -> C -> D" in prose text. Instead, use a Mermaid diagram to visualize flows and pipelines.
- Include code examples where helpful, referencing actual code from the source
- Cross-reference other documentation pages using markdown links like [Page Title](slug)
- Be specific and developer-friendly, not generic
- Focus on "why" and "how", not just "what"
- Document important types, interfaces, and function signatures
- Note any gotchas, edge cases, or non-obvious behavior
- Keep the tone professional but approachable

## Diagrams

When explaining architecture, data flow, request lifecycle, or relationships between components, include a Mermaid diagram.
NEVER use ASCII art. Always use Mermaid fenced code blocks.

Supported diagram types and when to use them:
- \`flowchart TD\` for request flows, processing pipelines, decision trees
- \`sequenceDiagram\` for API call sequences, multi-service interactions
- \`erDiagram\` for database schemas and entity relationships
- \`stateDiagram-v2\` for state machines, lifecycle states
- \`classDiagram\` for class hierarchies, module structure

### Critical Mermaid syntax rules (MUST follow to avoid rendering errors):

1. **Always quote node labels that contain special characters.** Any label with parentheses, dots, ampersands, quotes, commas, or other non-alphanumeric characters MUST be wrapped in double quotes:
   - CORRECT: \`A["load connection & refresh token"]\`
   - WRONG: \`A[load connection & refresh token]\`
   - CORRECT: \`B["connector.sync (incremental)"]\`
   - WRONG: \`B[connector.sync (or incremental fetch)]\`

2. **Edge labels must also be quoted if they contain special characters:**
   - CORRECT: \`A -->|"yes"| B\`
   - CORRECT: \`A -->|no| B\`  (simple words are fine unquoted)

3. **Decision/rhombus nodes use curly braces \`{}\` but the label inside must be simple.** If the label has special characters, quote it:
   - CORRECT: \`H{"hasMore?"}\`
   - WRONG: \`H{hasMore?}\`

4. **Keep labels short and simple.** Prefer 2-4 words. Do NOT put function signatures, code expressions, or long descriptions in node labels.

5. **Do not use pipes \`|\` or brackets \`[]\` inside node labels.**

6. **Test your syntax mentally: if a label has anything besides letters, numbers, spaces, and hyphens, wrap it in double quotes.**

Example:
\`\`\`mermaid
flowchart TD
  A[Client Request] --> B{Auth Check}
  B -->|Valid| C[Process Request]
  B -->|Invalid| D[401 Response]
  C --> E[Return Data]
\`\`\`

Example with special characters:
\`\`\`mermaid
flowchart TD
  A["Pull job from queue"] --> B{"job.type"}
  B -->|discover| C["Run discovery"]
  B -->|sync| D["Sync items"]
  C --> E{"Has more?"}
  E -->|yes| C
  E -->|no| F["Update state"]
\`\`\`

Keep diagrams focused. One diagram per concept, not one giant diagram for everything.
Use short readable labels. Avoid putting full function signatures in nodes.

## Source References

At the end of each major ## section, add a collapsible source reference block listing the specific files and line ranges you drew from. Use the exact file paths from the source code provided above. Only reference files you actually used for that section.

Format:

<details><summary>Sources</summary>

- \`src/modules/auth/auth.service.ts\` (lines 45-92)
- \`src/modules/auth/guards/jwt.guard.ts\`
- \`src/config/auth.config.ts\` (lines 1-30)

</details>

If a section is based on a single file, still include the source block. The line ranges should reflect the relevant portions, not the entire file.

Produce only the markdown content, no JSON wrapping.`;

    const startTime = Date.now();

    const { text, usage } = await generateText({
      model: this.model,
      maxOutputTokens: 16384,
      temperature: 0.3,
      prompt,
    });

    const inputTokens = usage.inputTokens ?? 0;
    const outputTokens = usage.outputTokens ?? 0;
    const durationMs = Date.now() - startTime;

    this.aiUsageService
      .logUsage(
        CODE_ANALYSIS_MODEL,
        inputTokens,
        outputTokens,
        AiCallerType.SYSTEM,
        AiRequestType.CODE_ANALYSIS,
        context,
        { durationMs }
      )
      .catch((err: unknown) =>
        this.logger.error(`Failed to log doc page generation usage: ${err}`)
      );

    this.logger.log(`Generated page "${planPage.title}" (${outputTokens} tokens, ${durationMs}ms)`);

    return text;
  }
}
