import { type DynamicModule, Global, Logger, Module, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { HttpAdapterHost } from '@nestjs/core';

import { serve } from 'inngest/express';

import { env } from '../config/env.config';

import { inngest } from './inngest.client';
import { INNGEST_FUNCTIONS } from './inngest.decorator';
import { InngestService } from './inngest.service';

@Global()
@Module({})
export class InngestModule implements OnModuleInit {
  private readonly logger = new Logger(InngestModule.name);

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly httpAdapterHost: HttpAdapterHost
  ) {}

  onModuleInit() {
    // Auto-discover all providers decorated with @InngestFunctions()
    const providers = this.discoveryService.getProviders().filter((wrapper) => {
      if (!wrapper.metatype) return false;
      return Reflect.getMetadata(INNGEST_FUNCTIONS, wrapper.metatype);
    });

    const functions = providers.flatMap((wrapper) => {
      const instance = wrapper.instance;
      if (instance && typeof instance.definitions === 'function') {
        return instance.definitions();
      }
      return [];
    });

    this.logger.log(`Registered ${functions.length} Inngest functions`);

    // Mount the serve handler on Express
    const httpAdapter = this.httpAdapterHost.httpAdapter;
    const app = httpAdapter.getInstance();

    const handler = serve({
      client: inngest,
      functions,
      serveHost: process.env.INNGEST_SERVE_HOST || env.apiUrl,
      servePath: '/api/inngest',
    });

    app.use('/api/inngest', handler);
    this.logger.log('Inngest serve handler mounted at /api/inngest');
  }

  static forRoot(): DynamicModule {
    return {
      module: InngestModule,
      global: true,
      imports: [],
      providers: [DiscoveryService, InngestService],
      exports: [InngestService],
    };
  }
}
