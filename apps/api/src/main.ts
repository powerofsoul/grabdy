// Side-effect imports must be first
import 'dotenv/config';
import 'reflect-metadata';

import { getQueueToken } from '@nestjs/bullmq';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter as BullBoardAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import cookieParser from 'cookie-parser';
import express from 'express';
import basicAuth from 'express-basic-auth';

import { env } from './config/env.config';
import { CANVAS_OPS_QUEUE, DATA_SOURCE_QUEUE } from './modules/queue/queue.constants';
import { AppModule } from './app.module';

async function bootstrap() {
  const server = express();
  server.use(express.json({ limit: '5mb' }));

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

  app.use(cookieParser());

  // BullBoard setup with basic auth
  const serverAdapter = new BullBoardAdapter();
  serverAdapter.setBasePath('/admin/queues');

  const dataSourceQueue = app.get<Queue>(getQueueToken(DATA_SOURCE_QUEUE));
  const canvasOpsQueue = app.get<Queue>(getQueueToken(CANVAS_OPS_QUEUE));

  createBullBoard({
    queues: [new BullMQAdapter(dataSourceQueue), new BullMQAdapter(canvasOpsQueue)],
    serverAdapter,
  });

  app.use(
    '/admin/queues',
    basicAuth({
      users: { [env.bullBoardUsername]: env.bullBoardPassword },
      challenge: true,
      realm: 'BullBoard',
    }),
    serverAdapter.getRouter()
  );

  const isDev = env.nodeEnv === 'development';

  app.enableCors({
    origin: isDev ? true : env.frontendUrl,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'X-API-Key',
    ],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  await app.listen(env.port);
  console.log(`Server running at http://localhost:${env.port}`);
  console.log(`CORS: ${isDev ? 'development mode (all origins)' : env.frontendUrl}`);
}

bootstrap();
