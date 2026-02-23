import { Injectable, Logger } from '@nestjs/common';

import { AiRequestType, CODE_ANALYSIS_MODEL } from '@grabdy/contracts';
import type { LanguageModel } from 'ai';
import { z } from 'zod';

import { InjectEnv } from '../../config/env.config';
import { type AiCallContext, AiService } from '../../modules/ai/ai.service';
import { createBedrockModel } from '../../modules/ai/bedrock.provider';
import { stripMarkdownFences } from '../constants';

// ── Schemas ──────────────────────────────────────────────────────────

const docPlanPageSchema = z.object({
  title: z.string(),
  slug: z.string(),
  parentSlug: z.string().nullable(),
  sortOrder: z.number(),
  description: z.string(),
  relevantFiles: z.array(z.string()),
  contentGuidelines: z.string(),
});

const docPlanSchema = z.object({
  pages: z.array(docPlanPageSchema),
});

export type DocPlanPage = z.infer<typeof docPlanPageSchema>;
export type DocPlan = z.infer<typeof docPlanSchema>;

const incrementalUpdateSchema = z.object({
  pagesToUpdate: z.array(z.string()),
  pagesToAdd: z.array(docPlanPageSchema),
  pagesToRemove: z.array(z.string()),
});

export type IncrementalUpdate = z.infer<typeof incrementalUpdateSchema>;

// ── Service ──────────────────────────────────────────────────────────

@Injectable()
export class DocPlannerService {
  private readonly logger = new Logger(DocPlannerService.name);
  private readonly model: LanguageModel;

  constructor(
    @InjectEnv('codeAnalysisModel') model: string,
    @InjectEnv('awsRegion') region: string,
    private aiService: AiService
  ) {
    this.model = createBedrockModel(region, model);
  }

  async planDocumentation(
    repoFullName: string,
    directoryTree: string,
    fileSummaries: string,
    languageBreakdown: string,
    context: AiCallContext
  ): Promise<DocPlan> {
    const prompt = `You are a documentation architect. Plan a multi-page documentation structure for the repository "${repoFullName}".

Repository structure:
${directoryTree}

File summaries:
${fileSummaries}

Language breakdown: ${languageBreakdown}

Create a documentation plan with multiple pages organized in a hierarchy. Each page should cover a focused topic. Return a JSON object with this exact structure:
{
  "pages": [
    {
      "title": "Page title",
      "slug": "kebab-case-slug",
      "parentSlug": null or "parent-slug",
      "sortOrder": 0,
      "description": "What this page covers",
      "relevantFiles": ["path/to/file1.ts", "path/to/file2.ts"],
      "contentGuidelines": "Specific instructions for generating this page's content"
    }
  ]
}

Plan these page categories (include only those that are relevant to the codebase):
1. **Architecture Overview** (top-level, always include): High-level system architecture, tech stack, project structure
2. **Module pages** (one per major module/package/directory): Purpose, public API, internal design, key types
3. **Data Flow**: How data moves through the system, database schema, state management
4. **API Reference**: REST endpoints, GraphQL schema, RPC contracts, authentication
5. **Configuration & Deployment**: Environment variables, build process, deployment, infrastructure
6. **Troubleshooting & Runbooks**: Common issues, debugging tips, operational procedures
7. **Potential Issues**: Code smells, technical debt, areas needing improvement
8. **Dependencies**: Third-party libraries, version constraints, integration points

Rules:
- Use kebab-case slugs (e.g., "architecture-overview", "api-auth-module")
- Top-level pages have parentSlug: null
- Sub-pages reference their parent's slug
- Keep the total to 5-15 pages depending on repo complexity
- relevantFiles should list the most important files for each page (up to 20)
- contentGuidelines should be specific about what to cover and what tone to use

Respond with ONLY valid JSON, no markdown fencing or explanation.`;

    const response = await this.invokeModel(prompt, context);
    let raw: unknown;
    try {
      raw = JSON.parse(stripMarkdownFences(response));
    } catch {
      this.logger.error('Doc plan response is not valid JSON');
      return {
        pages: [
          {
            title: 'Architecture Overview',
            slug: 'architecture-overview',
            parentSlug: null,
            sortOrder: 0,
            description: 'High-level overview of the repository architecture',
            relevantFiles: [],
            contentGuidelines:
              'Provide a comprehensive overview of the codebase structure and tech stack.',
          },
        ],
      };
    }
    const parsed = docPlanSchema.safeParse(raw);

    if (!parsed.success) {
      this.logger.error(`Failed to parse doc plan: ${parsed.error.message}`);
      // Return a minimal fallback plan
      return {
        pages: [
          {
            title: 'Architecture Overview',
            slug: 'architecture-overview',
            parentSlug: null,
            sortOrder: 0,
            description: 'High-level overview of the repository architecture',
            relevantFiles: [],
            contentGuidelines:
              'Provide a comprehensive overview of the codebase structure and tech stack.',
          },
        ],
      };
    }

    return parsed.data;
  }

  async planIncrementalUpdate(
    repoFullName: string,
    existingPages: Array<{
      slug: string;
      title: string;
      description: string;
      relevantFiles: string[];
    }>,
    changedFiles: string[],
    fileSummaries: string,
    context: AiCallContext
  ): Promise<IncrementalUpdate> {
    const existingPagesText = existingPages
      .map((p) => `- ${p.slug}: "${p.title}" (covers: ${p.relevantFiles.slice(0, 5).join(', ')})`)
      .join('\n');

    const prompt = `You are a documentation architect. The repository "${repoFullName}" has been updated and the documentation needs to be refreshed.

Existing documentation pages:
${existingPagesText}

Changed files:
${changedFiles.join('\n')}

Updated file summaries (for changed files):
${fileSummaries}

Determine what documentation changes are needed. Return a JSON object:
{
  "pagesToUpdate": ["slug1", "slug2"],
  "pagesToAdd": [
    {
      "title": "New Page Title",
      "slug": "new-page-slug",
      "parentSlug": null,
      "sortOrder": 0,
      "description": "What this new page covers",
      "relevantFiles": ["path/to/new/file.ts"],
      "contentGuidelines": "Instructions for generating content"
    }
  ],
  "pagesToRemove": ["obsolete-slug"]
}

Rules:
- Only include pages in pagesToUpdate if the changed files are relevant to that page
- Only add new pages if the changes introduce entirely new modules or concepts
- Only remove pages if the changes completely eliminate a module
- Be conservative: prefer updating over adding/removing

Respond with ONLY valid JSON, no markdown fencing or explanation.`;

    const response = await this.invokeModel(prompt, context);
    let raw: unknown;
    try {
      raw = JSON.parse(stripMarkdownFences(response));
    } catch {
      this.logger.warn('Incremental update response is not valid JSON');
      const slugsToUpdate = existingPages
        .filter((page) => page.relevantFiles.some((f) => changedFiles.includes(f)))
        .map((p) => p.slug);
      return {
        pagesToUpdate: slugsToUpdate.length > 0 ? slugsToUpdate : existingPages.map((p) => p.slug),
        pagesToAdd: [],
        pagesToRemove: [],
      };
    }
    const parsed = incrementalUpdateSchema.safeParse(raw);

    if (!parsed.success) {
      this.logger.warn(`Failed to parse incremental update plan: ${parsed.error.message}`);
      // Fallback: update all pages that reference changed files
      const slugsToUpdate = existingPages
        .filter((page) => page.relevantFiles.some((f) => changedFiles.includes(f)))
        .map((p) => p.slug);
      return {
        pagesToUpdate: slugsToUpdate.length > 0 ? slugsToUpdate : existingPages.map((p) => p.slug),
        pagesToAdd: [],
        pagesToRemove: [],
      };
    }

    return parsed.data;
  }

  private async invokeModel(prompt: string, context: AiCallContext): Promise<string> {
    const result = await this.aiService.generateText(
      { model: this.model, maxOutputTokens: 8192, temperature: 0.2, prompt },
      CODE_ANALYSIS_MODEL,
      AiRequestType.CODE_ANALYSIS,
      context
    );

    return result.text;
  }
}
