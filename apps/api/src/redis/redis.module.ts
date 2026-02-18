import { Global, Injectable, Logger, Module, OnModuleDestroy } from '@nestjs/common';

import Redis from 'ioredis';

import { InjectEnv } from '../config/env.config';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(
    @InjectEnv('redisHost') host: string,
    @InjectEnv('redisPort') port: number,
    @InjectEnv('redisPassword') password: string | undefined
  ) {
    super({ host, port, password, maxRetriesPerRequest: 3 });
    this.logger.log(`Redis connected to ${host}:${port}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.quit();
  }
}

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
