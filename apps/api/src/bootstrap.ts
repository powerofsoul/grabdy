import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';

import cookieParser from 'cookie-parser';
import express from 'express';

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

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

  app.use(cookieParser());

  // Build OpenAPI spec from Zod schemas
  const openApiDocument = buildOpenApiDocument();

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

  await app.listen(env.port);
  console.log(`Server running at http://localhost:${env.port}`);
  console.log(`CORS: ${isDev ? 'development mode (all origins)' : env.frontendUrl}`);
}
