import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';

import { EncryptionModule } from './common/encryption/encryption.module';
import { ApiKeyModule } from './common/guards/api-key.module';
import { AuthGuard } from './common/guards/auth.guard';
import { OrgAccessGuard } from './common/guards/org-access.guard';
import { SdkJwtModule } from './common/guards/sdk-jwt.module';
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
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { DataSourcesModule } from './modules/data-sources/data-sources.module';
import { DemoRequestModule } from './modules/demo-request/demo-request.module';
import { EmailModule } from './modules/email/email.module';
import { HealthModule } from './modules/health/health.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { McpModule } from './modules/mcp/mcp.module';
import { NotificationModule } from './modules/notification/notification.module';
import { OrgsModule } from './modules/orgs/orgs.module';
import { PublicApiModule } from './modules/public-api/public-api.module';
import { SdkChatModule } from './modules/sdk-chat/sdk-chat.module';
import { UsersModule } from './modules/users/users.module';
import { QueueModule } from './queue/queue.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    EnvModule,
    DbModule,
    RedisModule,
    EncryptionModule,
    ApiKeyModule,
    SdkJwtModule,
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
    AdminModule,
    AgentModule,
    AiModule,
    AnalyticsModule,
    EmailModule,
    NotificationModule,
    HealthModule,
    AuthModule,
    OrgsModule,
    UsersModule,
    CollectionsModule,
    DataSourcesModule,
    DemoRequestModule,
    ChatModule,
    ApiKeysModule,
    IntegrationsModule,
    PublicApiModule,
    McpModule,
    SdkChatModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: OrgAccessGuard },
    { provide: APP_INTERCEPTOR, useClass: TokenRefreshInterceptor },
  ],
})
export class AppModule {}
