import { Module } from '@nestjs/common';

import { LoggerModule } from 'nestjs-pino';

import { EncryptionModule } from './common/encryption/encryption.module';
import { EnvModule } from './config/env.config';
import { DbModule } from './db/db.module';
import { AgentModule } from './modules/agent/agent.module';
import { AiModule } from './modules/ai/ai.module';
import { IngestionModule } from './modules/data-sources/ingestion.module';
import { EmailModule } from './modules/email/email.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ProxyModule } from './modules/proxy/proxy.module';
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
    // Global modules (provide services to all processor modules)
    AiModule,
    AgentModule,
    EmailModule,
    NotificationModule,
    ProxyModule,
    // Processor module
    IngestionModule,
  ],
})
export class WorkerModule {}
