import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import Redis from 'ioredis';

import { env } from '../../config/env.config';
import { DATA_SOURCE_QUEUE, INTEGRATION_SYNC_QUEUE } from '../queue/queue.constants';
import { IntegrationSyncProcessor } from '../queue/processors/integration-sync.processor';

import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { TokenEncryptionService } from './token-encryption.service';
import { ProviderRegistry } from './providers/provider-registry';
import { AsanaConnector } from './providers/asana/asana.connector';
import { ConfluenceConnector } from './providers/confluence/confluence.connector';
import { FigmaConnector } from './providers/figma/figma.connector';
import { GitHubConnector } from './providers/github/github.connector';
import { GoogleDriveConnector } from './providers/google-drive/google-drive.connector';
import { JiraConnector } from './providers/jira/jira.connector';
import { LinearConnector } from './providers/linear/linear.connector';
import { NotionConnector } from './providers/notion/notion.connector';
import { SlackConnector } from './providers/slack/slack.connector';
import { TrelloConnector } from './providers/trello/trello.connector';
import { SyncSchedulerService } from './sync-scheduler.service';
import { INTEGRATIONS_REDIS } from './integrations.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: INTEGRATION_SYNC_QUEUE }),
    BullModule.registerQueue({ name: DATA_SOURCE_QUEUE }),
    ScheduleModule.forRoot(),
  ],
  controllers: [IntegrationsController],
  providers: [
    {
      provide: INTEGRATIONS_REDIS,
      useFactory: () =>
        new Redis({
          host: env.redisHost,
          port: env.redisPort,
          password: env.redisPassword,
          maxRetriesPerRequest: 3,
        }),
    },
    IntegrationsService,
    TokenEncryptionService,
    ProviderRegistry,
    AsanaConnector,
    ConfluenceConnector,
    FigmaConnector,
    GitHubConnector,
    GoogleDriveConnector,
    JiraConnector,
    LinearConnector,
    NotionConnector,
    SlackConnector,
    TrelloConnector,
    SyncSchedulerService,
    IntegrationSyncProcessor,
  ],
  exports: [IntegrationsService],
})
export class IntegrationsModule implements OnModuleDestroy {
  constructor(@Inject(INTEGRATIONS_REDIS) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
