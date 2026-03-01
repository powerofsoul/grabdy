import { NestFactory } from '@nestjs/core';

import { Logger } from 'nestjs-pino';

import { WorkerModule } from './worker.module';

export async function bootstrapWorker() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  const logger = app.get(Logger);
  app.useLogger(logger);

  app.enableShutdownHooks();

  logger.log('Worker started, processing background jobs');
}
