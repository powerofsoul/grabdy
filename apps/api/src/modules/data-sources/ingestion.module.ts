import { Module } from '@nestjs/common';

import { IntegrationsModule } from '../integrations/integrations.module';
import { StorageModule } from '../storage/storage.module';

import { DataSourceCleanupProcessor } from './processors/cleanup.processor';
import { FileIngestionProcessor } from './processors/file-ingestion.processor';
import { IntegrationCleanupProcessor } from './processors/integration-cleanup.processor';
import { IntegrationSyncProcessor } from './processors/integration-sync.processor';
import { IntegrationWebhookProcessor } from './processors/integration-webhook.processor';
import { SlackBotProcessor } from './processors/slack-bot.processor';
import { IntegrationIngestionService } from './services/integration-ingestion.service';
import { FileIngestionService } from './sources/file/file-ingestion.service';
import { SlackModule } from './sources/slack/slack.module';
import { SlackIngestionService } from './sources/slack/slack-ingestion.service';
import { DataSourcesModule } from './data-sources.module';

const ingestionServices = [
  FileIngestionService,
  IntegrationIngestionService,
  SlackIngestionService,
];

const processors = [
  FileIngestionProcessor,
  IntegrationSyncProcessor,
  IntegrationWebhookProcessor,
  IntegrationCleanupProcessor,
  SlackBotProcessor,
  DataSourceCleanupProcessor,
];

@Module({
  imports: [DataSourcesModule, IntegrationsModule, SlackModule, StorageModule],
  providers: [...ingestionServices, ...processors],
})
export class IngestionModule {}
