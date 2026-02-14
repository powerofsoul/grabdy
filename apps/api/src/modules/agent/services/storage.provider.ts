import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';

import { PostgresStore } from '@mastra/pg';

import { InjectEnv } from '../../../config/env.config';

@Injectable()
export class AgentStorageProvider implements OnModuleInit {
  private readonly logger = new Logger(AgentStorageProvider.name);
  private store: PostgresStore | null = null;

  constructor(
    @InjectEnv('databaseUrl') private readonly databaseUrl: string,
    @InjectEnv('nodeEnv') private readonly nodeEnv: string,
  ) {}

  async onModuleInit() {
    const connectionString =
      this.nodeEnv === 'production' && !this.databaseUrl.includes('sslmode=')
        ? `${this.databaseUrl}${this.databaseUrl.includes('?') ? '&' : '?'}sslmode=require&uselibpqcompat=true`
        : this.databaseUrl;

    this.store = new PostgresStore({
      id: 'grabdy-agent-store',
      connectionString,
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
