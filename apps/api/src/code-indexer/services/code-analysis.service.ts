import { Injectable, Logger } from '@nestjs/common';

import { AiCallerType, AiRequestType, CODE_ANALYSIS_MODEL } from '@grabdy/contracts';
import { generateText, type LanguageModel } from 'ai';
import { z } from 'zod';

import { InjectEnv } from '../../config/env.config';
import { AiUsageService, type UsageContext } from '../../modules/ai/ai-usage.service';
import { createBedrockModel } from '../bedrock-model';
import { stripMarkdownFences } from '../constants';

const fileSectionSchema = z.object({
  startLine: z.number(),
  endLine: z.number(),
  description: z.string(),
});

const fileAnalysisSchema = z.object({
  summary: z.string(),
  sections: z.array(fileSectionSchema),
});

export type FileAnalysis = z.infer<typeof fileAnalysisSchema>;

@Injectable()
export class CodeAnalysisService {
  private readonly logger = new Logger(CodeAnalysisService.name);
  private readonly model: LanguageModel;

  constructor(
    @InjectEnv('codeAnalysisModel') model: string,
    @InjectEnv('awsRegion') region: string,
    private aiUsageService: AiUsageService
  ) {
    this.model = createBedrockModel(region, model);
  }

  async analyzeFile(
    filePath: string,
    content: string,
    language: string,
    context: UsageContext
  ): Promise<FileAnalysis> {
    const prompt = `Analyze this ${language} file and return a JSON object with:
1. "summary": A concise 1-2 sentence description of what this file does.
2. "sections": An array of logical code sections, each with "startLine" (number), "endLine" (number), and "description" (string). Target sections of 50-200 lines. Group related functions, classes, or logic blocks together.

File: ${filePath}

\`\`\`${language.toLowerCase()}
${content}
\`\`\`

Respond with ONLY valid JSON, no markdown fencing or explanation.`;

    const response = await this.invokeModel(prompt, context);
    let raw: unknown;
    try {
      raw = JSON.parse(stripMarkdownFences(response));
    } catch {
      this.logger.warn(`AI response for ${filePath} is not valid JSON, using fallback`);
      const lineCount = content.split('\n').length;
      return {
        summary: `${language} file at ${filePath}`,
        sections: [{ startLine: 1, endLine: lineCount, description: `Full file: ${filePath}` }],
      };
    }
    const parsed = fileAnalysisSchema.safeParse(raw);

    if (!parsed.success) {
      this.logger.warn(`Failed to parse AI analysis for ${filePath}: ${parsed.error.message}`);
      // Fallback: treat entire file as one section
      const lineCount = content.split('\n').length;
      return {
        summary: `${language} file at ${filePath}`,
        sections: [{ startLine: 1, endLine: lineCount, description: `Full file: ${filePath}` }],
      };
    }

    return parsed.data;
  }

  async generateDocumentation(
    repoFullName: string,
    directoryTree: string,
    fileSummaries: string,
    languageBreakdown: string,
    previousDoc: string | null,
    changedFiles: string[] | null,
    context: UsageContext
  ): Promise<string> {
    let prompt: string;

    if (previousDoc && changedFiles) {
      prompt = `You are updating the documentation for the repository "${repoFullName}".

Here is the previous documentation:
${previousDoc}

The following files were changed in the latest update:
${changedFiles.join('\n')}

Here is the current repository structure with file summaries:
${directoryTree}

${fileSummaries}

Language breakdown: ${languageBreakdown}

Update the existing documentation to reflect the changes. Keep sections that haven't changed. Add or modify sections for changed areas. Produce a comprehensive markdown document covering: architecture overview, key modules and their responsibilities, data flow, and dependencies.`;
    } else {
      prompt = `Generate comprehensive documentation for the repository "${repoFullName}".

Repository structure with file summaries:
${directoryTree}

${fileSummaries}

Language breakdown: ${languageBreakdown}

Produce a markdown document covering:
1. Architecture overview
2. Key modules and their responsibilities
3. Data flow
4. Dependencies
5. Getting started notes

Write clear, developer-friendly documentation.`;
    }

    return this.invokeModel(prompt, context);
  }

  private async invokeModel(prompt: string, context: UsageContext): Promise<string> {
    const startTime = Date.now();

    const { text, usage } = await generateText({
      model: this.model,
      maxOutputTokens: 8192,
      temperature: 0.2,
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
      .catch((err: unknown) => this.logger.error(`Failed to log code analysis usage: ${err}`));

    return text;
  }
}
