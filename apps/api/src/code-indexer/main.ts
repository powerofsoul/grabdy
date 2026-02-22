import 'dotenv/config';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { dbIdSchema } from '@grabdy/common';

import { EncryptionModule } from '../common/encryption/encryption.module';
import { EnvModule } from '../config/env.config';
import { loadSsmParameters } from '../config/ssm';
import { DbModule } from '../db/db.module';
import { AiModule } from '../modules/ai/ai.module';

import { CodeAnalysisService } from './services/code-analysis.service';
import { CodeIndexerService } from './services/code-indexer.service';
import { DocPageGeneratorService } from './services/doc-page-generator.service';
import { DocPlannerService } from './services/doc-planner.service';

@Module({
  imports: [EnvModule, DbModule, EncryptionModule, AiModule],
  providers: [CodeIndexerService, CodeAnalysisService, DocPlannerService, DocPageGeneratorService],
})
class IndexerModule {}

async function main(): Promise<void> {
  // Load SSM parameters (no-op in dev)
  await loadSsmParameters();

  const dataSourceId = dbIdSchema('DataSource').parse(process.env.INDEXER_DATA_SOURCE_ID);
  const orgId = dbIdSchema('Org').parse(process.env.INDEXER_ORG_ID);
  const repoFullName = process.env.INDEXER_REPO;
  const branch = process.env.INDEXER_BRANCH ?? 'main';
  const connectionId = dbIdSchema('Connection').parse(process.env.INDEXER_CONNECTION_ID);
  const mode = process.env.INDEXER_MODE === 'incremental' ? 'incremental' : 'full';

  if (!repoFullName) {
    throw new Error('INDEXER_REPO is required');
  }

  const app = await NestFactory.createApplicationContext(IndexerModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const indexer = app.get(CodeIndexerService);
    await indexer.indexRepo({
      dataSourceId,
      orgId,
      repoFullName,
      branch,
      connectionId,
      mode,
    });

    console.log('Indexing completed successfully');
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('Indexing failed:', error instanceof Error ? error.message : error);
    await app.close();
    process.exit(1);
  }
}

main();
