import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { LoggerModule } from 'nestjs-pino';

import { EncryptionModule } from './common/encryption/encryption.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AuthGuard } from './common/guards/auth.guard';
import { OrgAccessGuard } from './common/guards/org-access.guard';
import { TokenRefreshInterceptor } from './common/interceptors/token-refresh.interceptor';
import {
  THROTTLE_LONG_LIMIT,
  THROTTLE_LONG_TTL_MS,
  THROTTLE_MEDIUM_LIMIT,
  THROTTLE_MEDIUM_TTL_MS,
  THROTTLE_SHORT_LIMIT,
  THROTTLE_SHORT_TTL_MS,
} from './config/constants';
import { EnvModule } from './config/env.config';
import { DbModule } from './db/db.module';
import { AdminModule } from './modules/admin/admin.module';
import { AgentModule } from './modules/agent/agent.module';
import { AiModule } from './modules/ai/ai.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { ChatModule } from './modules/chat/chat.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { DataSourcesModule } from './modules/data-sources/data-sources.module';
import { IngestionModule } from './modules/data-sources/ingestion.module';
import { DemoRequestModule } from './modules/demo-request/demo-request.module';
import { EmailModule } from './modules/email/email.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationModule } from './modules/notification/notification.module';
import { OrgsModule } from './modules/orgs/orgs.module';
import { ProxyModule } from './modules/proxy/proxy.module';
import { ProxyRoutesModule } from './modules/proxy/proxy-routes.module';
import { UsersModule } from './modules/users/users.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        autoLogging: false,
      },
    }),
    EnvModule,
    DbModule,
    RedisModule,
    EncryptionModule,
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: THROTTLE_SHORT_TTL_MS,
        limit: THROTTLE_SHORT_LIMIT,
      },
      {
        name: 'medium',
        ttl: THROTTLE_MEDIUM_TTL_MS,
        limit: THROTTLE_MEDIUM_LIMIT,
      },
      {
        name: 'long',
        ttl: THROTTLE_LONG_TTL_MS,
        limit: THROTTLE_LONG_LIMIT,
      },
    ]),
    QueueModule,
    // In production, processors run in a separate worker process (worker.module.ts).
    // Locally, run everything in one process for convenience.
    ...(process.env.NODE_ENV !== 'production' ? [IngestionModule] : []),
    AdminModule,
    AgentModule,
    BillingModule,
    AiModule,
    AnalyticsModule,
    EmailModule,
    NotificationModule,
    HealthModule,
    AuthModule,
    OrgsModule,
    UsersModule,
    CollectionsModule,
    ContractsModule,
    DataSourcesModule,
    ProxyModule,
    ProxyRoutesModule,
    DemoRequestModule,
    ChatModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: OrgAccessGuard },
    { provide: APP_INTERCEPTOR, useClass: TokenRefreshInterceptor },
  ],
})
export class AppModule {}
