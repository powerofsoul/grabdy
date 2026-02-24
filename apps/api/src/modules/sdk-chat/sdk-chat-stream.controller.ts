import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import { type DbId, dbIdSchema } from '@grabdy/common';
import {
  type SdkChatSourceConfig,
  type SdkStreamBody,
  sdkStreamBodySchema,
} from '@grabdy/contracts';
import { Request, Response } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { SdkJwtGuard } from '../../common/guards/sdk-jwt.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DbService } from '../../db/db.module';
import { AgentMemoryService } from '../agent/services/memory.service';
import { DataSourcesService } from '../data-sources/data-sources.service';

import { SdkChatStreamService } from './sdk-chat-stream.service';

@Controller()
export class SdkChatStreamController {
  private readonly logger = new Logger(SdkChatStreamController.name);

  constructor(
    private sdkChatStreamService: SdkChatStreamService,
    private agentMemory: AgentMemoryService,
    private dataSourcesService: DataSourcesService,
    private db: DbService
  ) {}

  @Public()
  @UseGuards(SdkJwtGuard)
  @Get('/sdk/chat/history')
  async getHistory(@Req() req: Request) {
    const sdkAuth = req.sdkAuth;
    if (!sdkAuth) {
      return { success: false, error: 'Unauthorized' };
    }

    // Find existing thread for this SDK chat + external user
    const thread = await this.sdkChatStreamService.findThread(
      sdkAuth.sdkChatId,
      sdkAuth.externalUser,
      sdkAuth.orgId
    );

    if (!thread) {
      return { success: true, data: { messages: [], threadId: null } };
    }

    const messages = await this.agentMemory.getHistory(thread);

    return {
      success: true,
      data: {
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt?.toISOString() ?? null,
        })),
        threadId: thread,
      },
    };
  }

  @Public()
  @UseGuards(SdkJwtGuard)
  @Post('/sdk/chat/stream')
  async streamChat(
    @Req() req: Request,
    @Body(new ZodValidationPipe(sdkStreamBodySchema)) body: SdkStreamBody,
    @Res() res: Response
  ) {
    const sdkAuth = req.sdkAuth;
    if (!sdkAuth) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    try {
      const result = await this.sdkChatStreamService.streamChat(
        sdkAuth,
        body.message,
        body.threadId
      );

      // AI SDK v6 data stream protocol
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Vercel-AI-Data-Stream', 'v1');
      res.flushHeaders();

      const streamStart = Date.now();
      let textChunks = 0;
      let fullText = '';

      for await (const part of result.streamResult.fullStream) {
        if (part.type === 'text-delta') {
          textChunks++;
          fullText += part.text;
          res.write(`0:${JSON.stringify(part.text)}\n`);
        } else if (part.type === 'tool-call') {
          this.logger.log(
            `[sdk-stream] Tool call: ${part.toolName} args=${JSON.stringify(part.input).slice(0, 500)}`
          );
        } else if (part.type === 'tool-result') {
          this.logger.log(`[sdk-stream] Tool result: ${part.toolName} OK`);
        } else if (part.type === 'tool-error') {
          this.logger.error(
            `[sdk-stream] Tool ERROR: ${part.toolName} error=${part.error instanceof Error ? part.error.message : JSON.stringify(part.error)}`
          );
        } else if (part.type === 'error') {
          this.logger.error(
            `[sdk-stream] Stream ERROR: ${part.error instanceof Error ? part.error.message : JSON.stringify(part.error)}`
          );
        }
      }

      // Signal text streaming complete (enables parseBlocks in embed)
      res.write(`8:${JSON.stringify({ type: 'text_done' })}\n`);

      // Save assistant message after stream completes
      await result.saveAssistant(fullText);

      this.logger.log(
        `[sdk-stream] Complete at +${Date.now() - streamStart}ms, ${textChunks} text chunks`
      );

      res.write(
        `8:${JSON.stringify({
          type: 'done',
          threadId: result.threadId,
          durationMs: Date.now() - streamStart,
        })}\n`
      );

      res.end();
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Stream failed',
        });
      } else {
        res.end();
      }
    }
  }

  @Public()
  @UseGuards(SdkJwtGuard)
  @Get('/sdk/data-sources/:id/preview-url')
  async getPreviewUrl(@Param('id') rawParam: string, @Req() req: Request) {
    const sdkAuth = req.sdkAuth;
    if (!sdkAuth) {
      throw new UnauthorizedException('Unauthorized');
    }

    const parseResult = dbIdSchema('DataSource').safeParse(rawParam);
    if (!parseResult.success) {
      throw new NotFoundException('Data source not found');
    }
    const dataSourceId = parseResult.data;

    // Verify the data source is accessible via SDK config
    const hasAccess = await this.verifyDataSourceAccess(
      sdkAuth.dataSourceConfig,
      dataSourceId,
      sdkAuth.orgId
    );
    if (!hasAccess) {
      throw new NotFoundException('Data source not found');
    }

    const preview = await this.dataSourcesService.getPreviewUrl(sdkAuth.orgId, dataSourceId);
    return { success: true, data: preview };
  }

  private async verifyDataSourceAccess(
    config: SdkChatSourceConfig,
    dataSourceId: DbId<'DataSource'>,
    orgId: DbId<'Org'>
  ): Promise<boolean> {
    // Check direct DATA_SOURCE entries
    for (const entry of config) {
      if (entry.type === 'DATA_SOURCE' && entry.dataSourceId === dataSourceId) {
        return true;
      }
    }

    // Check COLLECTION entries: query DB to see if data source belongs to any configured collection
    const collectionIds = config
      .filter((e): e is Extract<typeof e, { type: 'COLLECTION' }> => e.type === 'COLLECTION')
      .map((e) => e.collectionId);

    if (collectionIds.length === 0) {
      return false;
    }

    const result = await this.db.kysely
      .selectFrom('data.data_sources')
      .select('id')
      .where('id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .where('collection_id', 'in', collectionIds)
      .executeTakeFirst();

    return !!result;
  }
}
