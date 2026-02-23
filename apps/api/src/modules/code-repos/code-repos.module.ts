import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { IntegrationsModule } from '../integrations/integrations.module';
import { CODE_REPO_DOC_GEN_QUEUE, CODE_REPO_QUEUE } from '../queue/queue.constants';

import { CodeRepoSyncProcessor } from './processors/code-repo-sync.processor';
import { DocGenProcessor } from './processors/doc-gen.processor';
import { CodeIndexerSpawnerService } from './services/code-indexer-spawner.service';
import { DocEmbeddingService } from './services/doc-embedding.service';
import { CodeReposController } from './code-repos.controller';
import { CodeReposService } from './code-repos.service';

@Module({
  imports: [
    IntegrationsModule,
    BullModule.registerQueue({ name: CODE_REPO_QUEUE }),
    BullModule.registerQueue({ name: CODE_REPO_DOC_GEN_QUEUE }),
  ],
  controllers: [CodeReposController],
  providers: [
    CodeReposService,
    CodeIndexerSpawnerService,
    CodeRepoSyncProcessor,
    DocGenProcessor,
    DocEmbeddingService,
  ],
  exports: [CodeReposService, CodeIndexerSpawnerService],
})
export class CodeReposModule {}
