import { Module } from '@nestjs/common';

import { McpModule as McpNestModule, McpTransportType } from '@rekog/mcp-nest';

import { Public } from '../../common/decorators/public.decorator';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CollectionsModule } from '../collections/collections.module';
import { PublicApiModule } from '../public-api/public-api.module';

import { McpTools } from './mcp.tools';

@Module({
  imports: [
    PublicApiModule,
    CollectionsModule,
    McpNestModule.forRoot({
      name: 'grabdy',
      version: '1.0.0',
      transport: McpTransportType.STREAMABLE_HTTP,
      apiPrefix: 'api/v1',
      mcpEndpoint: 'mcp',
      guards: [ApiKeyGuard],
      decorators: [Public()],
    }),
  ],
  providers: [McpTools],
})
export class McpModule {}
