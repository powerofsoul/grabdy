import { Module } from '@nestjs/common';

import { LoggerModule } from 'nestjs-pino';

import { EncryptionModule } from './common/encryption/encryption.module';
import { EnvModule } from './config/env.config';
import { DbModule } from './db/db.module';
import { AiModule } from './modules/ai/ai.module';
import { BillingModule } from './modules/billing/billing.module';
import { BotModule } from './modules/bot/bot.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { DataSourcesModule } from './modules/data-sources/data-sources.module';
import { IngestionModule } from './modules/data-sources/ingestion.module';
import { EmailModule } from './modules/email/email.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { NotificationModule } from './modules/notification/notification.module';
import { OrgsModule } from './modules/orgs/orgs.module';
import { StorageModule } from './modules/storage/storage.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
        autoLogging: false,
      },
    }),
    EnvModule,
    DbModule,
    RedisModule,
    EncryptionModule,
    QueueModule,
    // Processor modules
    IngestionModule,
    AiModule,
    EmailModule,
    NotificationModule,
    // Transitive deps required by processors
    DataSourcesModule,
    IntegrationsModule,
    StorageModule,
    CollectionsModule,
    BillingModule,
    OrgsModule,
    BotModule,
  ],
})
export class WorkerModule {}
