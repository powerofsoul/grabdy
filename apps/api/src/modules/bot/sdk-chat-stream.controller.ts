import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { type DbId, dbIdSchema } from '@grabdy/common';
import {
  type BotSourceConfig,
  chatSourceSchema,
  type SdkStreamBody,
  sdkStreamBodySchema,
} from '@grabdy/contracts';
import { Request, Response } from 'express';
import { z } from 'zod';

import { Public } from '../../common/decorators/public.decorator';
import { SdkJwtGuard } from '../../common/guards/sdk-jwt.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DbService } from '../../db/db.module';
import { AgentMemoryService } from '../agent/services/memory.service';
import { ChatAttachmentService } from '../chat/chat-attachment.service';
import { DataSourcesService } from '../data-sources/data-sources.service';

import { BotService } from './bot.service';
import { SdkChatStreamService } from './sdk-chat-stream.service';

@Controller()
export class SdkChatStreamController {
  constructor(
    private sdkChatStreamService: SdkChatStreamService,
    private botService: BotService,
    private agentMemory: AgentMemoryService,
    private dataSourcesService: DataSourcesService,
    private chatAttachmentService: ChatAttachmentService,
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
      sdkAuth.botId,
      sdkAuth.externalUser,
      sdkAuth.orgId
    );

    if (!thread) {
      return { success: true, data: { messages: [], threadId: null } };
    }

    const messages = await this.agentMemory.getHistory(thread);

    const sourcesArraySchema = z.array(chatSourceSchema);

    return {
      success: true,
      data: {
        messages: messages.map((m) => {
          const parsedSources = m.sources ? sourcesArraySchema.safeParse(m.sources) : null;
          return {
            id: m.id,
            role: m.role,
            content: m.content,
            sources: parsedSources?.success ? parsedSources.data : null,
            thinkingTexts: m.thinkingTexts ?? null,
            durationMs: m.durationMs ?? null,
            attachments: m.attachments ?? null,
            createdAt: m.createdAt?.toISOString() ?? null,
          };
        }),
        threadId: thread,
      },
    };
  }

  @Public()
  @Get('/sdk/chat/:chatId/config')
  async getConfig(
    @Param('chatId', new ZodValidationPipe(dbIdSchema('Bot')))
    chatId: DbId<'Bot'>
  ) {
    const appearance = await this.botService.getAppearance(chatId);
    if (!appearance) {
      throw new NotFoundException('Bot not found');
    }
    return { success: true, data: appearance };
  }

  @Public()
  @UseGuards(SdkJwtGuard)
  @Post('/sdk/chat/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadAttachment(@Req() req: Request, @UploadedFile() file: Express.Multer.File) {
    const sdkAuth = req.sdkAuth;
    if (!sdkAuth) {
      throw new UnauthorizedException('Unauthorized');
    }
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const attachment = await this.chatAttachmentService.upload(sdkAuth.orgId, file);
    return { success: true, data: attachment };
  }

  @Public()
  @UseGuards(SdkJwtGuard)
  @Get('/sdk/chat/attachments/url')
  async getAttachmentUrl(@Req() req: Request, @Query('storageKey') storageKey: string) {
    const sdkAuth = req.sdkAuth;
    if (!sdkAuth) {
      throw new UnauthorizedException('Unauthorized');
    }
    if (!storageKey || !storageKey.startsWith(`chat-attachments/${sdkAuth.orgId}/`)) {
      throw new BadRequestException('Invalid storage key');
    }
    const url = await this.chatAttachmentService.getSignedUrl(storageKey);
    return { success: true, data: { url } };
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
      // Validate attachment storage keys belong to this org
      const prefix = `chat-attachments/${sdkAuth.orgId}/`;
      if (body.attachments?.some((a) => !a.storageKey.startsWith(prefix))) {
        res.status(400).json({ success: false, error: 'Invalid attachment storage key' });
        return;
      }

      // Build attachment context if attachments provided
      const attachmentContext =
        body.attachments && body.attachments.length > 0
          ? await this.chatAttachmentService.buildAttachmentContext(body.attachments)
          : undefined;

      const sseStream = await this.sdkChatStreamService.streamChat(sdkAuth, body.message, {
        threadId: body.threadId,
        attachments: body.attachments,
        attachmentContext,
      });

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Vercel-AI-Data-Stream', 'v1');
      res.flushHeaders();

      for await (const line of sseStream) {
        res.write(line);
      }

      res.end();
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Stream failed',
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
    config: BotSourceConfig,
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
