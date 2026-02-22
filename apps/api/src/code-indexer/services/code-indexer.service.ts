import { Injectable, Logger } from '@nestjs/common';

import { openai } from '@ai-sdk/openai';
import { type DbId, extractOrgNumericId, packId } from '@grabdy/common';
import { AiCallerType, AiRequestType, type ChunkMeta, EMBEDDING_MODEL } from '@grabdy/contracts';
import { createAppAuth } from '@octokit/auth-app';
import { embedMany } from 'ai';
import { execFileSync } from 'child_process';
import { closeSync, existsSync, mkdirSync, openSync, readSync, readdirSync, readFileSync, statSync } from 'fs';
import { sql } from 'kysely';
import pLimit from 'p-limit';
import { extname, join, relative } from 'path';

import { EncryptionService } from '../../common/encryption/encryption.service';
import { EMBEDDING_BATCH_SIZE } from '../../config/constants';
import { InjectEnv } from '../../config/env.config';
import { DbService } from '../../db/db.module';
import { AiUsageService } from '../../modules/ai/ai-usage.service';
import { chunkPlainText } from '../../modules/data-sources/chunking/chunk-content';
import {
  getLanguageForExtension,
  INDEXABLE_EXTENSIONS,
  MAX_CONCURRENT_AI_CALLS,
  MAX_FILE_SIZE_BYTES,
  SKIP_DIRECTORIES,
  SKIP_FILES,
} from '../constants';

import { CodeAnalysisService, type FileAnalysis } from './code-analysis.service';
import { DocPageGeneratorService } from './doc-page-generator.service';
import { DocPlannerService, type DocPlanPage } from './doc-planner.service';

/** Validates that a string contains only safe characters for use in git commands. */
function assertSafeGitRef(value: string, label: string): void {
  if (!/^[a-zA-Z0-9._\-/]+$/.test(value)) {
    throw new Error(`Unsafe ${label}: "${value}" contains invalid characters`);
  }
}

interface IndexerParams {
  dataSourceId: DbId<'DataSource'>;
  orgId: DbId<'Org'>;
  repoFullName: string;
  branch: string;
  connectionId: DbId<'Connection'>;
  mode: 'full' | 'incremental';
}

interface FileSummary {
  path: string;
  language: string;
  summary: string;
}

@Injectable()
export class CodeIndexerService {
  private readonly logger = new Logger(CodeIndexerService.name);

  constructor(
    private db: DbService,
    private encryption: EncryptionService,
    private codeAnalysis: CodeAnalysisService,
    private docPlanner: DocPlannerService,
    private docPageGenerator: DocPageGeneratorService,
    private aiUsageService: AiUsageService,
    @InjectEnv('reposBasePath') private readonly reposBasePath: string,
    @InjectEnv('githubAppId') private readonly githubAppId: string,
    @InjectEnv('githubPrivateKey') private readonly githubPrivateKey: string
  ) {}

  async indexRepo(params: IndexerParams): Promise<void> {
    this.logger.log(`Starting ${params.mode} indexing for ${params.repoFullName}`);

    try {
      // Step 1: Get GitHub token
      const token = await this.getGitHubToken(params.connectionId);

      // Step 2: Clone or pull
      const repoPath = await this.cloneOrPull(params, token);

      // Record HEAD commit
      const headSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoPath, encoding: 'utf-8' }).trim();

      // Step 3: Discover files
      const lastSha = await this.getLastCommitSha(params.dataSourceId);
      let filesToProcess: string[];

      if (params.mode === 'incremental' && lastSha) {
        filesToProcess = this.getChangedFiles(repoPath, lastSha, headSha);

        // Delete chunks for changed/deleted files in batch
        if (filesToProcess.length > 0) {
          await this.deleteChunksForFiles(
            params.dataSourceId,
            params.orgId,
            filesToProcess,
            params.repoFullName
          );
        }
      } else {
        filesToProcess = this.discoverFiles(repoPath);
      }

      // Update total files
      await this.db.kysely
        .updateTable('data.code_repo_state')
        .set({ total_files: filesToProcess.length, updated_at: new Date() })
        .where('data_source_id', '=', params.dataSourceId)
        .execute();

      this.logger.log(`Found ${filesToProcess.length} files to process`);

      // Step 4: Process files
      const fileSummaries: FileSummary[] = [];
      const usageContext = { orgId: params.orgId, source: 'SYSTEM' as const };

      // Process in batches with concurrency limit
      const limit = pLimit(MAX_CONCURRENT_AI_CALLS);

      let processedCount = 0;
      const filePromises = filesToProcess.map((filePath) =>
        limit(async () => {
          try {
            const summary = await this.processFile(repoPath, filePath, params, usageContext);
            if (summary) {
              fileSummaries.push(summary);
            }
          } catch (err) {
            this.logger.warn(`Failed to process ${filePath}: ${err}`);
          }

          processedCount++;
          if (processedCount % 10 === 0) {
            await this.db.kysely
              .updateTable('data.code_repo_state')
              .set({ processed_files: processedCount, updated_at: new Date() })
              .where('data_source_id', '=', params.dataSourceId)
              .execute();
          }

          // Refresh token periodically (every 50 files)
          if (processedCount % 50 === 0) {
            try {
              await this.getGitHubToken(params.connectionId);
            } catch {
              // Token refresh failure is not critical mid-indexing
            }
          }
        })
      );

      await Promise.all(filePromises);

      // Final processed count update
      await this.db.kysely
        .updateTable('data.code_repo_state')
        .set({ processed_files: processedCount, updated_at: new Date() })
        .where('data_source_id', '=', params.dataSourceId)
        .execute();

      // Step 5: Generate multi-page documentation
      await this.generateDocPages(
        repoPath,
        params,
        fileSummaries,
        headSha,
        usageContext,
        params.mode === 'incremental' ? filesToProcess : null,
        lastSha
      );

      // Step 6: Finalize
      await this.db.kysely
        .updateTable('data.data_sources')
        .set({ status: 'READY', updated_at: new Date() })
        .where('id', '=', params.dataSourceId)
        .execute();

      await this.db.kysely
        .updateTable('data.code_repo_state')
        .set({ last_commit_sha: headSha, updated_at: new Date() })
        .where('data_source_id', '=', params.dataSourceId)
        .execute();

      this.logger.log(
        `Indexing complete for ${params.repoFullName}: ${processedCount} files, commit ${headSha}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Indexing failed for ${params.repoFullName}: ${message}`);

      await this.db.kysely
        .updateTable('data.data_sources')
        .set({ status: 'FAILED', updated_at: new Date() })
        .where('id', '=', params.dataSourceId)
        .execute();

      throw error;
    }
  }

  private async getGitHubToken(connectionId: DbId<'Connection'>): Promise<string> {
    const connection = await this.db.kysely
      .selectFrom('integration.connections')
      .select(['access_token', 'refresh_token'])
      .where('id', '=', connectionId)
      .executeTakeFirst();

    if (!connection) {
      throw new Error('GitHub connection not found');
    }

    const encryptedToken = connection.access_token;
    const refreshToken = connection.refresh_token;

    // Try existing token first
    const token = await this.encryption.decrypt(encryptedToken);

    // If we have an installation ID (stored as refresh_token), refresh
    if (refreshToken) {
      const installationId = parseInt(await this.encryption.decrypt(refreshToken), 10);
      if (!isNaN(installationId)) {
        try {
          const auth = createAppAuth({
            appId: this.githubAppId,
            privateKey: this.decodePrivateKey(),
          });
          const result = await auth({ type: 'installation', installationId });
          return result.token;
        } catch (err) {
          this.logger.warn(`Token refresh failed, using existing token: ${err}`);
        }
      }
    }

    return token;
  }

  private decodePrivateKey(): string {
    const raw = this.githubPrivateKey;
    if (raw.startsWith('-----BEGIN')) return raw.replace(/\\n/g, '\n');
    return Buffer.from(raw, 'base64').toString('utf8');
  }

  private async cloneOrPull(params: IndexerParams, token: string): Promise<string> {
    assertSafeGitRef(params.repoFullName, 'repo name');
    assertSafeGitRef(params.branch, 'branch name');

    const orgNum = extractOrgNumericId(params.orgId);
    const repoDir = params.repoFullName.replace('/', '-');
    const repoPath = join(this.reposBasePath, String(orgNum), repoDir);

    const authUrl = `https://x-access-token:${token}@github.com/${params.repoFullName}.git`;

    if (existsSync(join(repoPath, '.git'))) {
      this.logger.log(`Pulling latest for ${params.repoFullName}`);
      execFileSync('git', ['remote', 'set-url', 'origin', authUrl], { cwd: repoPath });
      execFileSync('git', ['fetch', 'origin'], { cwd: repoPath });
      execFileSync('git', ['checkout', params.branch], { cwd: repoPath });
      execFileSync('git', ['reset', '--hard', `origin/${params.branch}`], { cwd: repoPath });
    } else {
      this.logger.log(`Cloning ${params.repoFullName}`);
      mkdirSync(repoPath, { recursive: true });
      execFileSync(
        'git',
        ['clone', '--branch', params.branch, '--depth', '50', authUrl, repoPath],
        { timeout: 300_000 } // 5 minute timeout for large repos
      );
    }

    // Remove token from persisted remote URL to prevent credential leakage on EFS
    const safeUrl = `https://github.com/${params.repoFullName}.git`;
    execFileSync('git', ['remote', 'set-url', 'origin', safeUrl], { cwd: repoPath });

    return repoPath;
  }

  private discoverFiles(repoPath: string): string[] {
    const files: string[] = [];
    this.walkDirectory(repoPath, repoPath, files);
    return files;
  }

  private walkDirectory(basePath: string, currentPath: string, files: string[]): void {
    const entries = readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;

      const fullPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        this.walkDirectory(basePath, fullPath, files);
      } else if (entry.isFile()) {
        if (SKIP_FILES.has(entry.name)) continue;

        const ext = extname(entry.name).toLowerCase();
        if (!INDEXABLE_EXTENSIONS.has(ext)) continue;

        // Check file size
        const stats = statSync(fullPath);
        if (stats.size > MAX_FILE_SIZE_BYTES) continue;

        // Check for binary content (first 512 bytes)
        const buffer = Buffer.alloc(512);
        const fd = openSync(fullPath, 'r');
        const bytesRead = readSync(fd, buffer, 0, 512, 0);
        closeSync(fd);

        const slice = buffer.subarray(0, bytesRead);
        if (slice.includes(0)) continue; // Binary file

        files.push(relative(basePath, fullPath));
      }
    }
  }

  private getChangedFiles(repoPath: string, lastSha: string, headSha: string): string[] {
    try {
      const output = execFileSync('git', ['diff', '--name-only', `${lastSha}..${headSha}`], {
        cwd: repoPath,
        encoding: 'utf-8',
      });
      return output
        .split('\n')
        .filter((f) => f.trim().length > 0)
        .filter((f) => {
          const ext = extname(f).toLowerCase();
          return INDEXABLE_EXTENSIONS.has(ext) && !SKIP_FILES.has(f.split('/').pop() ?? '');
        });
    } catch {
      // If diff fails (e.g., force push), fall back to full index
      this.logger.warn('git diff failed, falling back to full file discovery');
      return this.discoverFiles(repoPath);
    }
  }

  private getFileDiffs(
    repoPath: string,
    lastSha: string,
    headSha: string,
    files: string[]
  ): string {
    if (files.length === 0) return '';
    try {
      const diff = execFileSync(
        'git',
        ['diff', `${lastSha}..${headSha}`, '--', ...files],
        { cwd: repoPath, encoding: 'utf-8', maxBuffer: 1024 * 1024 }
      );
      // Truncate if too large to keep prompt within token limits
      const maxDiffLength = 15000;
      if (diff.length > maxDiffLength) {
        return diff.slice(0, maxDiffLength) + '\n... (diff truncated)';
      }
      return diff;
    } catch {
      this.logger.warn('Failed to get file diffs');
      return '';
    }
  }

  private async getLastCommitSha(dataSourceId: DbId<'DataSource'>): Promise<string | null> {
    const row = await this.db.kysely
      .selectFrom('data.code_repo_state')
      .select('last_commit_sha')
      .where('data_source_id', '=', dataSourceId)
      .executeTakeFirst();
    return row?.last_commit_sha ?? null;
  }

  private async deleteChunksForFiles(
    dataSourceId: DbId<'DataSource'>,
    orgId: DbId<'Org'>,
    filePaths: string[],
    repoFullName: string
  ): Promise<void> {
    // Batch delete: remove chunks for any of the given file paths in one query
    const pathArray = JSON.stringify(filePaths);
    await sql`
      DELETE FROM data.chunks
      WHERE data_source_id = ${dataSourceId}
        AND org_id = ${orgId}
        AND metadata->>'type' = 'CODE_REPO'
        AND metadata->>'repoFullName' = ${repoFullName}
        AND metadata->>'filePath' = ANY(ARRAY(SELECT jsonb_array_elements_text(${pathArray}::jsonb)))
    `.execute(this.db.kysely);
  }

  private async processFile(
    repoPath: string,
    filePath: string,
    params: IndexerParams,
    usageContext: { orgId: DbId<'Org'>; source: 'SYSTEM' }
  ): Promise<FileSummary | null> {
    const fullPath = join(repoPath, filePath);
    if (!existsSync(fullPath)) return null;

    const content = readFileSync(fullPath, 'utf-8');
    if (content.trim().length === 0) return null;

    const ext = extname(filePath).toLowerCase();
    const language = getLanguageForExtension(ext);
    const sourceUrl = `https://github.com/${params.repoFullName}/blob/${params.branch}/${filePath}`;

    let analysis: FileAnalysis;
    try {
      analysis = await this.codeAnalysis.analyzeFile(filePath, content, language, usageContext);
    } catch (err) {
      // Fallback to plain text chunking
      this.logger.warn(`AI analysis failed for ${filePath}, using fallback: ${err}`);
      const meta: ChunkMeta = {
        type: 'CODE_REPO',
        filePath,
        language,
        repoFullName: params.repoFullName,
        startLine: 1,
        endLine: content.split('\n').length,
        fileSummary: `${language} file`,
      };
      const chunks = chunkPlainText(content, meta, sourceUrl);
      await this.embedAndStore(chunks, params, sourceUrl);
      return { path: filePath, language, summary: `${language} file` };
    }

    // Create chunks from AI-identified sections
    const lines = content.split('\n');
    const chunks: Array<{ content: string; metadata: ChunkMeta; sourceUrl: string }> = [];

    for (const section of analysis.sections) {
      const startLine = Math.max(1, section.startLine);
      const endLine = Math.min(lines.length, section.endLine);
      const sectionContent = lines.slice(startLine - 1, endLine).join('\n');

      if (sectionContent.trim().length === 0) continue;

      const prefixed = `// File: ${filePath}\n// Summary: ${analysis.summary}\n// Section: ${section.description}\n\n${sectionContent}`;

      const meta: ChunkMeta = {
        type: 'CODE_REPO',
        filePath,
        language,
        repoFullName: params.repoFullName,
        startLine,
        endLine,
        fileSummary: analysis.summary,
      };

      const chunkUrl = `${sourceUrl}#L${startLine}-L${endLine}`;
      chunks.push({ content: prefixed, metadata: meta, sourceUrl: chunkUrl });
    }

    if (chunks.length > 0) {
      await this.embedAndStore(chunks, params, sourceUrl);
    }

    return { path: filePath, language, summary: analysis.summary };
  }

  private async embedAndStore(
    chunks: Array<{ content: string; metadata: ChunkMeta; sourceUrl: string }>,
    params: IndexerParams,
    _sourceUrl: string
  ): Promise<void> {
    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);

      const { embeddings, usage: embeddingUsage } = await embedMany({
        model: openai.embedding('text-embedding-3-small'),
        values: batch.map((c) => c.content),
      });

      this.aiUsageService
        .logUsage(
          EMBEDDING_MODEL,
          embeddingUsage.tokens,
          0,
          AiCallerType.SYSTEM,
          AiRequestType.EMBEDDING,
          { orgId: params.orgId, source: 'SYSTEM' }
        )
        .catch((err) => this.logger.error(`Embedding usage logging failed: ${err}`));

      const values = batch.map((chunk, idx) => ({
        id: packId('Chunk', params.orgId),
        content: chunk.content,
        chunk_index: i + idx,
        metadata: chunk.metadata,
        source_url: chunk.sourceUrl,
        embedding: `[${embeddings[idx].join(',')}]`,
        data_source_id: params.dataSourceId,
        collection_id: null,
        org_id: params.orgId,
      }));

      await this.db.kysely.insertInto('data.chunks').values(values).execute();
    }
  }

  async generateDocPages(
    repoPath: string | null,
    params: IndexerParams,
    fileSummaries: FileSummary[],
    headSha: string,
    usageContext: { orgId: DbId<'Org'>; source: 'SYSTEM' },
    changedFiles: string[] | null,
    lastSha: string | null
  ): Promise<void> {
    const dirTree = this.buildDirectoryTree(fileSummaries);
    const summariesText = fileSummaries
      .map((f) => `- ${f.path} (${f.language}): ${f.summary}`)
      .join('\n');

    const langCounts = new Map<string, number>();
    for (const f of fileSummaries) {
      langCounts.set(f.language, (langCounts.get(f.language) ?? 0) + 1);
    }
    const langBreakdown = [...langCounts.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([lang, count]) => `${lang}: ${count} files`)
      .join(', ');

    // Build a lookup of file summaries by path
    const summaryByPath = new Map<string, FileSummary>();
    for (const fs of fileSummaries) {
      summaryByPath.set(fs.path, fs);
    }

    try {
      if (changedFiles && lastSha) {
        await this.generateDocPagesIncremental(
          repoPath,
          params,
          fileSummaries,
          headSha,
          usageContext,
          changedFiles,
          summariesText,
          summaryByPath,
          lastSha
        );
      } else {
        await this.generateDocPagesFull(
          repoPath,
          params,
          fileSummaries,
          headSha,
          usageContext,
          dirTree,
          summariesText,
          langBreakdown,
          summaryByPath
        );
      }
    } catch (err) {
      this.logger.error(`Doc page generation failed: ${err}`);
      // Non-fatal, indexing still succeeds without doc pages
    }
  }

  private async generateDocPagesFull(
    repoPath: string | null,
    params: IndexerParams,
    fileSummaries: FileSummary[],
    headSha: string,
    usageContext: { orgId: DbId<'Org'>; source: 'SYSTEM' },
    dirTree: string,
    summariesText: string,
    langBreakdown: string,
    summaryByPath: Map<string, FileSummary>
  ): Promise<void> {
    // Step 1: Plan documentation structure
    const plan = await this.docPlanner.planDocumentation(
      params.repoFullName,
      dirTree,
      summariesText,
      langBreakdown,
      usageContext
    );

    this.logger.log(`Doc plan: ${plan.pages.length} pages for ${params.repoFullName}`);

    // Step 2: Build slug-to-page lookup for cross-referencing
    const allPages = plan.pages;

    // Step 3: Generate pages concurrently (max 3)
    const pageLimit = pLimit(3);
    const pageResults: Array<{ planPage: DocPlanPage; content: string }> = [];

    const pagePromises = allPages.map((planPage) =>
      pageLimit(async () => {
        const relevantSourceCode = this.gatherRelevantSource(
          repoPath,
          planPage.relevantFiles,
          summaryByPath
        );

        const siblingPages = allPages
          .filter((p) => p.slug !== planPage.slug)
          .map((p) => ({ title: p.title, slug: p.slug, description: p.description }));

        const content = await this.docPageGenerator.generatePage(
          {
            planPage,
            relevantSourceCode,
            siblingPages,
            repoFullName: params.repoFullName,
          },
          usageContext
        );

        pageResults.push({ planPage, content });
      })
    );

    await Promise.all(pagePromises);

    // Step 4: Build a slug-to-DbId map for parent references
    // First, create all page IDs upfront
    const slugToId = new Map<string, DbId<'DocPage'>>();
    for (const planPage of allPages) {
      slugToId.set(planPage.slug, packId('DocPage', params.orgId));
    }

    // Step 5: Store pages and versions
    for (const { planPage, content } of pageResults) {
      const pageId = slugToId.get(planPage.slug);
      if (!pageId) continue;

      const parentId = planPage.parentSlug ? (slugToId.get(planPage.parentSlug) ?? null) : null;

      await this.db.kysely
        .insertInto('data.code_repo_doc_pages')
        .values({
          id: pageId,
          data_source_id: params.dataSourceId,
          parent_id: parentId,
          title: planPage.title,
          slug: planPage.slug,
          content,
          sort_order: planPage.sortOrder,
          is_user_edited: false,
          commit_sha: headSha,
          version: 1,
          org_id: params.orgId,
          updated_at: new Date(),
        })
        .execute();

      // Create version 1 entry
      await this.db.kysely
        .insertInto('data.code_repo_doc_page_versions')
        .values({
          id: packId('DocPageVersion', params.orgId),
          page_id: pageId,
          content,
          commit_sha: headSha,
          source: 'AI',
          version: 1,
          org_id: params.orgId,
        })
        .execute();
    }

    // Step 6: Embed each page as chunks
    await this.embedDocPages(params, pageResults, slugToId);

    this.logger.log(`Generated ${pageResults.length} doc pages for ${params.repoFullName}`);
  }

  private async generateDocPagesIncremental(
    repoPath: string | null,
    params: IndexerParams,
    fileSummaries: FileSummary[],
    headSha: string,
    usageContext: { orgId: DbId<'Org'>; source: 'SYSTEM' },
    changedFiles: string[],
    summariesText: string,
    summaryByPath: Map<string, FileSummary>,
    lastSha: string
  ): Promise<void> {
    // Get existing pages
    const existingPages = await this.db.kysely
      .selectFrom('data.code_repo_doc_pages')
      .select(['id', 'slug', 'title', 'content', 'is_user_edited', 'version'])
      .where('data_source_id', '=', params.dataSourceId)
      .where('org_id', '=', params.orgId)
      .execute();

    if (existingPages.length === 0) {
      // No existing pages, fall back to full generation
      const dirTree = this.buildDirectoryTree(fileSummaries);
      const langCounts = new Map<string, number>();
      for (const f of fileSummaries) {
        langCounts.set(f.language, (langCounts.get(f.language) ?? 0) + 1);
      }
      const langBreakdown = [...langCounts.entries()]
        .sort(([, a], [, b]) => b - a)
        .map(([lang, count]) => `${lang}: ${count} files`)
        .join(', ');

      await this.generateDocPagesFull(
        repoPath,
        params,
        fileSummaries,
        headSha,
        usageContext,
        dirTree,
        summariesText,
        langBreakdown,
        summaryByPath
      );
      return;
    }

    // Plan incremental update
    // We need the relevantFiles for each existing page. Query them from the plan metadata
    // stored in contentGuidelines. For now, infer from file summaries referencing pages.
    const existingPageInfo = existingPages.map((p) => ({
      slug: p.slug,
      title: p.title,
      description: '',
      relevantFiles: [] satisfies string[],
    }));

    const incrementalPlan = await this.docPlanner.planIncrementalUpdate(
      params.repoFullName,
      existingPageInfo,
      changedFiles,
      summariesText,
      usageContext
    );

    this.logger.log(
      `Incremental doc update: ${incrementalPlan.pagesToUpdate.length} update, ` +
        `${incrementalPlan.pagesToAdd.length} add, ${incrementalPlan.pagesToRemove.length} remove`
    );

    // Remove pages
    if (incrementalPlan.pagesToRemove.length > 0) {
      await this.db.kysely
        .deleteFrom('data.code_repo_doc_pages')
        .where('data_source_id', '=', params.dataSourceId)
        .where('slug', 'in', incrementalPlan.pagesToRemove)
        .execute();

      // Delete doc page chunks for removed pages in batch
      await this.deleteDocPageChunksBatch(
        params.dataSourceId,
        params.orgId,
        incrementalPlan.pagesToRemove
      );
    }

    // Update existing pages
    const pageLimit = pLimit(3);
    const updatePromises = incrementalPlan.pagesToUpdate.map((slug) =>
      pageLimit(async () => {
        const existingPage = existingPages.find((p) => p.slug === slug);
        if (!existingPage) return;

        // Build a synthetic plan page for regeneration
        const planPage: DocPlanPage = {
          title: existingPage.title,
          slug: existingPage.slug,
          parentSlug: null,
          sortOrder: 0,
          description: `Updated documentation for ${existingPage.title}`,
          relevantFiles: changedFiles,
          contentGuidelines: `Update this documentation page to reflect the recent source code changes. Preserve accurate content, update affected sections, and add new sections if needed.`,
        };

        const relevantSourceCode = this.gatherRelevantSource(repoPath, changedFiles, summaryByPath);

        // Get the actual git diff for the changed files so the AI knows what specifically changed
        const sourceDiff = repoPath
          ? this.getFileDiffs(repoPath, lastSha, headSha, changedFiles)
          : '';

        const siblingPages = existingPages
          .filter((p) => p.slug !== slug)
          .map((p) => ({ title: p.title, slug: p.slug, description: '' }));

        const newContent = await this.docPageGenerator.generatePage(
          {
            planPage,
            relevantSourceCode,
            siblingPages,
            repoFullName: params.repoFullName,
            currentContent: existingPage.content,
            sourceDiff: sourceDiff || undefined,
          },
          usageContext
        );

        const nextVersion = existingPage.version + 1;

        if (existingPage.is_user_edited) {
          // User-edited page: save new AI version but don't overwrite content
          await this.db.kysely
            .insertInto('data.code_repo_doc_page_versions')
            .values({
              id: packId('DocPageVersion', params.orgId),
              page_id: existingPage.id,
              content: newContent,
              commit_sha: headSha,
              source: 'AI',
              version: nextVersion,
              org_id: params.orgId,
            })
            .execute();

          this.logger.log(
            `Saved AI version ${nextVersion} for user-edited page "${slug}" (content preserved)`
          );
        } else {
          // AI-only page: overwrite content and bump version
          await this.db.kysely
            .updateTable('data.code_repo_doc_pages')
            .set({
              content: newContent,
              version: nextVersion,
              commit_sha: headSha,
              updated_at: new Date(),
            })
            .where('id', '=', existingPage.id)
            .execute();

          await this.db.kysely
            .insertInto('data.code_repo_doc_page_versions')
            .values({
              id: packId('DocPageVersion', params.orgId),
              page_id: existingPage.id,
              content: newContent,
              commit_sha: headSha,
              source: 'AI',
              version: nextVersion,
              org_id: params.orgId,
            })
            .execute();

          // Re-embed updated page
          await this.deleteDocPageChunks(params.dataSourceId, params.orgId, slug);
          await this.embedSingleDocPage(
            params,
            existingPage.id,
            existingPage.title,
            slug,
            newContent
          );

          this.logger.log(`Updated page "${slug}" to version ${nextVersion}`);
        }
      })
    );

    await Promise.all(updatePromises);

    // Add new pages
    if (incrementalPlan.pagesToAdd.length > 0) {
      const slugToId = new Map<string, DbId<'DocPage'>>();
      for (const planPage of incrementalPlan.pagesToAdd) {
        slugToId.set(planPage.slug, packId('DocPage', params.orgId));
      }

      const addPromises = incrementalPlan.pagesToAdd.map((planPage) =>
        pageLimit(async () => {
          const pageId = slugToId.get(planPage.slug);
          if (!pageId) return;

          const relevantSourceCode = this.gatherRelevantSource(
            repoPath,
            planPage.relevantFiles,
            summaryByPath
          );

          const siblingPages = existingPages.map((p) => ({
            title: p.title,
            slug: p.slug,
            description: '',
          }));

          const content = await this.docPageGenerator.generatePage(
            {
              planPage,
              relevantSourceCode,
              siblingPages,
              repoFullName: params.repoFullName,
            },
            usageContext
          );

          // Resolve parent ID from existing pages
          let parentId: DbId<'DocPage'> | null = null;
          if (planPage.parentSlug) {
            const parentPage = existingPages.find((p) => p.slug === planPage.parentSlug);
            if (parentPage) {
              parentId = parentPage.id;
            }
          }

          await this.db.kysely
            .insertInto('data.code_repo_doc_pages')
            .values({
              id: pageId,
              data_source_id: params.dataSourceId,
              parent_id: parentId,
              title: planPage.title,
              slug: planPage.slug,
              content,
              sort_order: planPage.sortOrder,
              is_user_edited: false,
              commit_sha: headSha,
              version: 1,
              org_id: params.orgId,
              updated_at: new Date(),
            })
            .execute();

          await this.db.kysely
            .insertInto('data.code_repo_doc_page_versions')
            .values({
              id: packId('DocPageVersion', params.orgId),
              page_id: pageId,
              content,
              commit_sha: headSha,
              source: 'AI',
              version: 1,
              org_id: params.orgId,
            })
            .execute();

          await this.embedSingleDocPage(params, pageId, planPage.title, planPage.slug, content);
        })
      );

      await Promise.all(addPromises);
    }

    this.logger.log(`Incremental doc update complete for ${params.repoFullName}`);
  }

  private gatherRelevantSource(
    repoPath: string | null,
    filePaths: string[],
    summaryByPath: Map<string, FileSummary>
  ): Array<{ path: string; content: string; summary: string }> {
    const results: Array<{ path: string; content: string; summary: string }> = [];

    for (const filePath of filePaths.slice(0, 20)) {
      const summaryEntry = summaryByPath.get(filePath);
      const summary = summaryEntry?.summary ?? 'No summary available';

      if (repoPath) {
        // Read from disk when repo is available
        const fullPath = join(repoPath, filePath);
        if (existsSync(fullPath)) {
          const content = readFileSync(fullPath, 'utf-8');
          results.push({ path: filePath, content, summary });
        }
      }
      // When repoPath is null (doc-gen-main.ts), caller should provide source from chunks
    }

    return results;
  }

  private async embedDocPages(
    params: IndexerParams,
    pageResults: Array<{ planPage: DocPlanPage; content: string }>,
    slugToId: Map<string, DbId<'DocPage'>>
  ): Promise<void> {
    for (const { planPage, content } of pageResults) {
      const pageId = slugToId.get(planPage.slug);
      if (!pageId) continue;

      await this.embedSingleDocPage(params, pageId, planPage.title, planPage.slug, content);
    }
  }

  private async embedSingleDocPage(
    params: IndexerParams,
    pageId: DbId<'DocPage'>,
    pageTitle: string,
    pageSlug: string,
    content: string
  ): Promise<void> {
    const docChunks = chunkPlainText(
      `# ${pageTitle}\n\n${content}`,
      {
        type: 'CODE_REPO',
        filePath: `docs/${pageSlug}`,
        language: 'Markdown',
        repoFullName: params.repoFullName,
        startLine: 1,
        endLine: content.split('\n').length,
        fileSummary: `Documentation page: ${pageTitle}`,
        docPageId: pageId,
        docPageTitle: pageTitle,
      },
      `https://github.com/${params.repoFullName}`
    );

    if (docChunks.length > 0) {
      await this.embedAndStore(docChunks, params, `https://github.com/${params.repoFullName}`);
    }
  }

  private async deleteDocPageChunks(
    dataSourceId: DbId<'DataSource'>,
    orgId: DbId<'Org'>,
    pageSlug: string
  ): Promise<void> {
    await sql`
      DELETE FROM data.chunks
      WHERE data_source_id = ${dataSourceId}
        AND org_id = ${orgId}
        AND metadata @> ${JSON.stringify({ type: 'CODE_REPO', filePath: `docs/${pageSlug}` })}::jsonb
    `.execute(this.db.kysely);
  }

  private async deleteDocPageChunksBatch(
    dataSourceId: DbId<'DataSource'>,
    orgId: DbId<'Org'>,
    pageSlugs: string[]
  ): Promise<void> {
    if (pageSlugs.length === 0) return;
    const filePaths = JSON.stringify(pageSlugs.map((s) => `docs/${s}`));
    await sql`
      DELETE FROM data.chunks
      WHERE data_source_id = ${dataSourceId}
        AND org_id = ${orgId}
        AND metadata->>'type' = 'CODE_REPO'
        AND metadata->>'filePath' = ANY(ARRAY(SELECT jsonb_array_elements_text(${filePaths}::jsonb)))
    `.execute(this.db.kysely);
  }

  private buildDirectoryTree(files: FileSummary[]): string {
    const tree = new Map<string, string[]>();
    for (const f of files) {
      const parts = f.path.split('/');
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
      const file = parts[parts.length - 1];
      const existing = tree.get(dir);
      if (existing) {
        existing.push(file);
      } else {
        tree.set(dir, [file]);
      }
    }

    const lines: string[] = [];
    const sortedDirs = [...tree.keys()].sort();
    for (const dir of sortedDirs) {
      lines.push(`${dir}/`);
      const dirFiles = tree.get(dir);
      if (dirFiles) {
        for (const file of [...dirFiles].sort()) {
          lines.push(`  ${file}`);
        }
      }
    }

    return lines.join('\n');
  }
}
