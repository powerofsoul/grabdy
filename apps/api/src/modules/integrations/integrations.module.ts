import { BullModule } from '@nestjs/bullmq';
import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import Redis from 'ioredis';

import { env } from '../../config/env.config';
import {
  DATA_SOURCE_QUEUE,
  INTEGRATION_SYNC_QUEUE,
  SLACK_BOT_QUEUE,
} from '../queue/queue.constants';

import { IntegrationSyncProcessor } from './processors/integration-sync.processor';

import { SlackBotProcessor } from './processors/slack-bot.processor';
import { ProviderRegistry } from './providers/provider-registry';
import { SlackConnector } from './providers/slack/slack.connector';
import { SlackBotService } from './providers/slack/slack-bot.service';
import { INTEGRATIONS_REDIS } from './integrations.constants';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { SyncSchedulerService } from './sync-scheduler.service';
import { TokenEncryptionService } from './token-encryption.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: INTEGRATION_SYNC_QUEUE }),
    BullModule.registerQueue({ name: DATA_SOURCE_QUEUE }),
    BullModule.registerQueue({ name: SLACK_BOT_QUEUE }),
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
    SlackBotService,
    SlackConnector,
    SyncSchedulerService,
    IntegrationSyncProcessor,
    SlackBotProcessor,
  ],
  exports: [IntegrationsService],
})
export class IntegrationsModule implements OnModuleDestroy {
  constructor(@Inject(INTEGRATIONS_REDIS) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
