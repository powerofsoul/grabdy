import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { ApiKeyModule } from './common/guards/api-key.module';
import { AuthGuard } from './common/guards/auth.guard';
import { OrgAccessGuard } from './common/guards/org-access.guard';
import { TokenRefreshInterceptor } from './common/interceptors/token-refresh.interceptor';
import {
  JOB_BACKOFF_DELAY_MS,
  JOB_MAX_ATTEMPTS,
  JOB_REMOVE_ON_COMPLETE_AGE_S,
  JOB_REMOVE_ON_COMPLETE_COUNT,
  JOB_REMOVE_ON_FAIL_AGE_S,
  JOB_REMOVE_ON_FAIL_COUNT,
  THROTTLE_LONG_LIMIT,
  THROTTLE_LONG_TTL_MS,
  THROTTLE_MEDIUM_LIMIT,
  THROTTLE_MEDIUM_TTL_MS,
  THROTTLE_SHORT_LIMIT,
  THROTTLE_SHORT_TTL_MS,
} from './config/constants';
import { EnvModule } from './config/env.config';
import { env } from './config/env.config';
import { DbModule } from './db/db.module';
import { AdminModule } from './modules/admin/admin.module';
import { AgentModule } from './modules/agent/agent.module';
import { AiModule } from './modules/ai/ai.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { DataSourcesModule } from './modules/data-sources/data-sources.module';
import { EmailModule } from './modules/email/email.module';
import { HealthModule } from './modules/health/health.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { McpModule } from './modules/mcp/mcp.module';
import { OrgsModule } from './modules/orgs/orgs.module';
import { PublicApiModule } from './modules/public-api/public-api.module';
import { UsersModule } from './modules/users/users.module';
import { WaitlistModule } from './modules/waitlist/waitlist.module';

@Module({
  imports: [
    EnvModule,
    DbModule,
    ApiKeyModule,
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
    BullModule.forRoot({
      connection: {
        host: env.redisHost,
        port: env.redisPort,
        password: env.redisPassword,
        maxRetriesPerRequest: null,
      },
      defaultJobOptions: {
        removeOnComplete: {
          age: JOB_REMOVE_ON_COMPLETE_AGE_S,
          count: JOB_REMOVE_ON_COMPLETE_COUNT,
        },
        removeOnFail: { age: JOB_REMOVE_ON_FAIL_AGE_S, count: JOB_REMOVE_ON_FAIL_COUNT },
        attempts: JOB_MAX_ATTEMPTS,
        backoff: { type: 'exponential', delay: JOB_BACKOFF_DELAY_MS },
      },
    }),
    AdminModule,
    AgentModule,
    AiModule,
    AnalyticsModule,
    EmailModule,
    HealthModule,
    AuthModule,
    OrgsModule,
    UsersModule,
    CollectionsModule,
    DataSourcesModule,
    ChatModule,
    ApiKeysModule,
    IntegrationsModule,
    PublicApiModule,
    McpModule,
    WaitlistModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: OrgAccessGuard },
    { provide: APP_INTERCEPTOR, useClass: TokenRefreshInterceptor },
  ],
})
export class AppModule {}
