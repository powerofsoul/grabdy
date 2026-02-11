import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';

import { PostgresStore } from '@mastra/pg';

import { InjectEnv } from '../../../config/env.config';

@Injectable()
export class AgentStorageProvider implements OnModuleInit {
  private readonly logger = new Logger(AgentStorageProvider.name);
  private store: PostgresStore | null = null;

  constructor(@InjectEnv('databaseUrl') private readonly databaseUrl: string) {}

  async onModuleInit() {
    this.store = new PostgresStore({
      id: 'grabdy-agent-store',
      connectionString: this.databaseUrl,
      schemaName: 'agent',
    });
    await this.store.init();
    this.logger.log('Agent PostgresStore initialized');
  }

  getStore(): PostgresStore {
    if (!this.store) {
      throw new InternalServerErrorException('AgentStorageProvider not initialized');
    }
    return this.store;
  }
}
