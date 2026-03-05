import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { type DbId, dbIdSchema } from '@grabdy/common';
import {
  chatContract,
  type DataSourceConfig,
  dataSourceConfigSchema,
  streamChatBodySchema,
} from '@grabdy/contracts';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Response } from 'express';
import { z } from 'zod';

import {
  CurrentMembership,
  JwtMembership,
} from '../../common/decorators/current-membership.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrgAccess } from '../../common/decorators/org-roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

import { ChatService } from './chat.service';
import { ChatAttachmentService } from './chat-attachment.service';

type StreamChatBody = z.infer<typeof streamChatBodySchema>;

function extractSourceConfigIds(config: DataSourceConfig): unknown[] {
  return config.map((s) => {
    switch (s.type) {
      case 'COLLECTION':
        return s.collectionId;
      case 'DATA_SOURCE':
        return s.dataSourceId;
    }
  });
}

@Controller()
export class ChatController {
  constructor(
    private chatService: ChatService,
    private chatAttachmentService: ChatAttachmentService
  ) {}

  @OrgAccess(chatContract.createThread, {
    params: ['orgId'],
  })
  @TsRestHandler(chatContract.createThread)
  async createThread(@CurrentMembership() membership: JwtMembership) {
    return tsRestHandler(chatContract.createThread, async ({ params, body }) => {
      const thread = await this.chatService.createThread(params.orgId, membership.id, {
        title: body.title,
      });

      return {
        status: 200 as const,
        body: { success: true as const, data: thread },
      };
    });
  }

  @OrgAccess(chatContract.listThreads, { params: ['orgId'] })
  @TsRestHandler(chatContract.listThreads)
  async listThreads(@CurrentMembership() membership: JwtMembership) {
    return tsRestHandler(chatContract.listThreads, async ({ params }) => {
      const threads = await this.chatService.listThreads(params.orgId, membership.id);

      return {
        status: 200 as const,
        body: { success: true as const, data: threads },
      };
    });
  }

  @OrgAccess(chatContract.getThread, { params: ['orgId', 'threadId'] })
  @TsRestHandler(chatContract.getThread)
  async getThread() {
    return tsRestHandler(chatContract.getThread, async ({ params }) => {
      const thread = await this.chatService.getThread(params.orgId, params.threadId);

      return {
        status: 200 as const,
        body: { success: true as const, data: thread },
      };
    });
  }

  @OrgAccess(chatContract.deleteThread, { params: ['orgId', 'threadId'] })
  @TsRestHandler(chatContract.deleteThread)
  async deleteThread() {
    return tsRestHandler(chatContract.deleteThread, async ({ params }) => {
      await this.chatService.deleteThread(params.orgId, params.threadId);

      return {
        status: 200 as const,
        body: { success: true as const },
      };
    });
  }

  @OrgAccess(chatContract.renameThread, { params: ['orgId', 'threadId'] })
  @TsRestHandler(chatContract.renameThread)
  async renameThread() {
    return tsRestHandler(chatContract.renameThread, async ({ params, body }) => {
      const thread = await this.chatService.renameThread(params.orgId, params.threadId, body.title);

      return {
        status: 200 as const,
        body: { success: true as const, data: thread },
      };
    });
  }

  @OrgAccess({ params: ['orgId'] })
  @Post('/orgs/:orgId/chat/attachments')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadAttachment(
    @Param('orgId', new ZodValidationPipe(dbIdSchema('Org')))
    orgId: DbId<'Org'>,
    @UploadedFile() file: Express.Multer.File
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const attachment = await this.chatAttachmentService.upload(orgId, file);
    return { success: true, data: attachment };
  }

  @OrgAccess({ params: ['orgId'] })
  @Get('/orgs/:orgId/chat/attachments/url')
  async getAttachmentUrl(
    @Param('orgId', new ZodValidationPipe(dbIdSchema('Org')))
    orgId: DbId<'Org'>,
    @Query('storageKey') storageKey: string
  ) {
    if (!storageKey || !storageKey.startsWith(`chat-attachments/${orgId}/`)) {
      throw new BadRequestException('Invalid storage key');
    }
    const url = await this.chatAttachmentService.getSignedUrl(storageKey);
    return { success: true, data: { url } };
  }

  @OrgAccess({
    params: ['orgId'],
    body: (b) => {
      const parsed = dataSourceConfigSchema.safeParse(b.dataSourceConfig);
      const configIds = parsed.success ? extractSourceConfigIds(parsed.data) : [];
      return [b.threadId, ...configIds];
    },
  })
  @Post('/orgs/:orgId/chat/stream')
  async streamChat(
    @Param('orgId', new ZodValidationPipe(dbIdSchema('Org')))
    orgId: DbId<'Org'>,
    @CurrentMembership() membership: JwtMembership,
    @CurrentUser('sub') userId: DbId<'User'>,
    @Body(new ZodValidationPipe(streamChatBodySchema)) body: StreamChatBody,
    @Res() res: Response
  ) {
    try {
      // Validate attachment storage keys belong to this org
      const prefix = `chat-attachments/${orgId}/`;
      if (body.attachments?.some((a) => !a.storageKey.startsWith(prefix))) {
        throw new BadRequestException('Invalid attachment storage key');
      }

      // Build attachment context if attachments provided
      const attachmentContext =
        body.attachments && body.attachments.length > 0
          ? await this.chatAttachmentService.buildAttachmentContext(body.attachments)
          : undefined;

      const sseStream = await this.chatService.streamChat(
        orgId,
        membership.id,
        userId,
        body.message,
        {
          threadId: body.threadId,
          dataSourceConfig: body.dataSourceConfig,
          attachments: body.attachments,
          attachmentContext,
        }
      );

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
}
