import 'dotenv/config';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { dbIdSchema } from '@grabdy/common';
import { chunkMetaSchema } from '@grabdy/contracts';

import { EncryptionModule } from '../common/encryption/encryption.module';
import { EnvModule } from '../config/env.config';
import { loadSsmParameters } from '../config/ssm';
import { DbModule, DbService } from '../db/db.module';
import { AiModule } from '../modules/ai/ai.module';

import { CodeAnalysisService } from './services/code-analysis.service';
import { CodeIndexerService } from './services/code-indexer.service';
import { DocPageGeneratorService } from './services/doc-page-generator.service';
import { DocPlannerService } from './services/doc-planner.service';

@Module({
  imports: [EnvModule, DbModule, EncryptionModule, AiModule],
  providers: [CodeIndexerService, CodeAnalysisService, DocPlannerService, DocPageGeneratorService],
})
class DocGenModule {}

interface FileSummaryRow {
  path: string;
  language: string;
  summary: string;
}

async function main(): Promise<void> {
  await loadSsmParameters();

  const dataSourceId = dbIdSchema('DataSource').parse(process.env.DOC_GEN_DATA_SOURCE_ID);
  const orgId = dbIdSchema('Org').parse(process.env.DOC_GEN_ORG_ID);
  const repo = process.env.DOC_GEN_REPO;
  const mode = process.env.DOC_GEN_MODE === 'incremental' ? 'incremental' : 'full';

  if (!repo) {
    throw new Error('DOC_GEN_REPO is required');
  }

  const app = await NestFactory.createApplicationContext(DocGenModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const db = app.get(DbService);
    const indexer = app.get(CodeIndexerService);

    // Read file summaries from existing chunks in the database
    const chunks = await db.kysely
      .selectFrom('data.chunks')
      .select(['metadata', 'content'])
      .where('data_source_id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .execute();

    // Extract file summaries from chunk metadata (parse JSONB with Zod)
    const fileMap = new Map<string, FileSummaryRow>();
    for (const chunk of chunks) {
      const parsed = chunkMetaSchema.safeParse(chunk.metadata);
      if (!parsed.success) continue;
      const meta = parsed.data;
      if (meta.type !== 'CODE_REPO') continue;
      // Skip doc page chunks
      if (meta.docPageId) continue;

      if (!fileMap.has(meta.filePath)) {
        fileMap.set(meta.filePath, {
          path: meta.filePath,
          language: meta.language,
          summary: meta.fileSummary,
        });
      }
    }

    const fileSummaries = Array.from(fileMap.values());

    // Get HEAD SHA from code_repo_state
    const stateRow = await db.kysely
      .selectFrom('data.code_repo_state')
      .select('last_commit_sha')
      .where('data_source_id', '=', dataSourceId)
      .executeTakeFirst();

    const headSha = stateRow?.last_commit_sha ?? 'unknown';

    // Determine changed files for incremental mode
    let changedFiles: string[] | null = null;
    if (mode === 'incremental') {
      // For incremental, use all file paths as "changed" since we don't have git diff here
      // The planner will determine which pages actually need updating
      changedFiles = fileSummaries.map((f) => f.path);
    }

    // Get state row for branch and connection_id
    const repoState = await db.kysely
      .selectFrom('data.code_repo_state')
      .select('branch')
      .where('data_source_id', '=', dataSourceId)
      .executeTakeFirst();

    const dsRow = await db.kysely
      .selectFrom('data.data_sources')
      .select('connection_id')
      .where('id', '=', dataSourceId)
      .executeTakeFirst();

    const connectionId = dsRow?.connection_id;
    if (!connectionId) {
      throw new Error('Data source has no connection_id');
    }

    await indexer.generateDocPages(
      null, // No repo path, reading from DB
      {
        dataSourceId,
        orgId,
        repoFullName: repo,
        branch: repoState?.branch ?? 'main',
        connectionId,
        mode,
      },
      fileSummaries,
      headSha,
      { orgId, source: 'SYSTEM' },
      changedFiles,
      null // No lastSha available in standalone mode
    );

    console.log('Doc generation completed successfully');
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('Doc generation failed:', error instanceof Error ? error.message : error);
    await app.close();
    process.exit(1);
  }
}

main();
