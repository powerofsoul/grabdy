import { Module } from '@nestjs/common';

import { TemporalModule as TemporalCoreModule } from 'nestjs-temporal-core';

import { env } from '../../config/env.config';
import { IntegrationsModule } from '../integrations/integrations.module';
import { StorageModule } from '../storage/storage.module';

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

@Module({
  imports: [
    DataSourcesModule,
    IntegrationsModule,
    SlackModule,
    StorageModule,
    TemporalCoreModule.register({
      connection: {
        address: env.temporalAddress,
        namespace: env.temporalNamespace,
      },
      taskQueue: 'grabdy-main',
      worker: {
        workflowsPath: require.resolve('./workflows'),
        activityClasses: ingestionServices,
        autoStart: true,
      },
      isGlobal: true,
    }),
  ],
  providers: ingestionServices,
})
export class IngestionModule {}
