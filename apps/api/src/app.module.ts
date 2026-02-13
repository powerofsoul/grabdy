import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthGuard } from './common/guards/auth.guard';
import {
  THROTTLE_LONG_LIMIT,
  THROTTLE_LONG_TTL_MS,
  THROTTLE_MEDIUM_LIMIT,
  THROTTLE_MEDIUM_TTL_MS,
  THROTTLE_SHORT_LIMIT,
  THROTTLE_SHORT_TTL_MS,
} from './config/constants';
import { OrgAccessGuard } from './common/guards/org-access.guard';
import { TokenRefreshInterceptor } from './common/interceptors/token-refresh.interceptor';
import { ApiKeyModule } from './common/guards/api-key.module';
import { EnvModule } from './config/env.config';
import { DbModule } from './db/db.module';
import { AgentModule } from './modules/agent/agent.module';
import { AiModule } from './modules/ai/ai.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { McpModule } from './modules/mcp/mcp.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { DataSourcesModule } from './modules/data-sources/data-sources.module';
import { EmailModule } from './modules/email/email.module';
import { HealthModule } from './modules/health/health.module';
import { OrgsModule } from './modules/orgs/orgs.module';
import { PublicApiModule } from './modules/public-api/public-api.module';
import { QueueModule } from './modules/queue/queue.module';
import { RetrievalModule } from './modules/retrieval/retrieval.module';
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
    AdminModule,
    AgentModule,
    AiModule,
    AnalyticsModule,
    EmailModule,
    QueueModule,
    HealthModule,
    AuthModule,
    OrgsModule,
    UsersModule,
    CollectionsModule,
    DataSourcesModule,
    RetrievalModule,
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
