import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';

import cookieParser from 'cookie-parser';
import express from 'express';
import { Logger } from 'nestjs-pino';

import { env } from './config/env.config';
import { buildOpenApiDocument } from './config/openapi';
import { AppModule } from './app.module';

export async function bootstrap() {
  const server = express();
  server.use(
    express.json({
      limit: '5mb',
      verify: (req, _res, buf) => {
        // Preserve raw body for webhook signature verification (Slack, etc.)
        Object.assign(req, { rawBody: buf.toString('utf-8') });
      },
    })
  );

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bufferLogs: true,
  });
  const logger = app.get(Logger);
  app.useLogger(logger);

  app.use(cookieParser());

  // Build OpenAPI spec from Zod schemas
  const openApiDocument = buildOpenApiDocument();

  // SDK endpoints use Bearer JWT from customer domains, so allow all origins.
  // Dashboard uses cookie auth with credentials: true (browser only sends
  // cookies when the response includes the matching origin, not '*').
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'Mcp-Session-Id',
    ],
    exposedHeaders: ['Mcp-Session-Id'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Register after CORS so headers are applied
  server.get('/v1/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });

  app.enableShutdownHooks();

  await app.listen(env.port);
  logger.log(`Server running at http://localhost:${env.port}`);
  logger.log(`CORS: all origins (SDK embeds on customer domains)`);
}
