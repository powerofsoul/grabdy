import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { type DbId, dbIdSchema } from '@grabdy/common';
import { chatContract, streamChatBodySchema } from '@grabdy/contracts';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Response } from 'express';
import { z } from 'zod';

type StreamChatBody = z.infer<typeof streamChatBodySchema>;

import {
  CurrentMembership,
  JwtMembership,
} from '../../common/decorators/current-membership.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrgAccess } from '../../common/decorators/org-roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

import { ChatService } from './chat.service';
import { ChatAttachmentService } from './chat-attachment.service';

@Controller()
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private chatService: ChatService,
    private chatAttachmentService: ChatAttachmentService
  ) {}

  @OrgAccess(chatContract.chat, { params: ['orgId'] })
  @TsRestHandler(chatContract.chat)
  async chat(
    @CurrentMembership() membership: JwtMembership,
    @CurrentUser('sub') userId: DbId<'User'>
  ) {
    return tsRestHandler(chatContract.chat, async ({ params, body }) => {
      try {
        const result = await this.chatService.chat(
          params.orgId,
          membership.id,
          userId,
          body.message,
          {
            threadId: body.threadId,
            collectionId: body.collectionId,
          }
        );

        return {
          status: 200 as const,
          body: {
            success: true as const,
            data: result,
          },
        };
      } catch (error) {
        return {
          status: 400 as const,
          body: {
            success: false as const,
            error: error instanceof Error ? error.message : 'Chat failed',
          },
        };
      }
    });
  }

  @OrgAccess(chatContract.createThread, { params: ['orgId'] })
  @TsRestHandler(chatContract.createThread)
  async createThread(@CurrentMembership() membership: JwtMembership) {
    return tsRestHandler(chatContract.createThread, async ({ params, body }) => {
      try {
        const thread = await this.chatService.createThread(params.orgId, membership.id, {
          title: body.title,
          collectionId: body.collectionId,
        });

        return {
          status: 200 as const,
          body: { success: true as const, data: thread },
        };
      } catch (error) {
        return {
          status: 400 as const,
          body: {
            success: false as const,
            error: error instanceof Error ? error.message : 'Failed to create thread',
          },
        };
      }
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

  @OrgAccess(chatContract.getThread, { params: ['orgId'] })
  @TsRestHandler(chatContract.getThread)
  async getThread() {
    return tsRestHandler(chatContract.getThread, async ({ params }) => {
      try {
        const thread = await this.chatService.getThread(params.orgId, params.threadId);

        return {
          status: 200 as const,
          body: { success: true as const, data: thread },
        };
      } catch (error) {
        return {
          status: 404 as const,
          body: {
            success: false as const,
            error: error instanceof Error ? error.message : 'Thread not found',
          },
        };
      }
    });
  }

  @OrgAccess(chatContract.deleteThread, { params: ['orgId'] })
  @TsRestHandler(chatContract.deleteThread)
  async deleteThread() {
    return tsRestHandler(chatContract.deleteThread, async ({ params }) => {
      try {
        await this.chatService.deleteThread(params.orgId, params.threadId);

        return {
          status: 200 as const,
          body: { success: true as const },
        };
      } catch (error) {
        return {
          status: 400 as const,
          body: {
            success: false as const,
            error: error instanceof Error ? error.message : 'Delete failed',
          },
        };
      }
    });
  }

  @OrgAccess(chatContract.renameThread, { params: ['orgId'] })
  @TsRestHandler(chatContract.renameThread)
  async renameThread() {
    return tsRestHandler(chatContract.renameThread, async ({ params, body }) => {
      try {
        const thread = await this.chatService.renameThread(
          params.orgId,
          params.threadId,
          body.title
        );

        return {
          status: 200 as const,
          body: { success: true as const, data: thread },
        };
      } catch (error) {
        return {
          status: 400 as const,
          body: {
            success: false as const,
            error: error instanceof Error ? error.message : 'Rename failed',
          },
        };
      }
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

  @OrgAccess({ params: ['orgId'] })
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

      const result = await this.chatService.streamChat(orgId, membership.id, userId, body.message, {
        threadId: body.threadId,
        collectionId: body.collectionId,
        attachments: body.attachments,
        attachmentContext,
      });

      // AI SDK v6 data stream protocol
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Vercel-AI-Data-Stream', 'v1');
      res.flushHeaders();

      const streamStart = Date.now();
      let textChunks = 0;
      let stepCount = 0;
      let fullText = '';

      for await (const part of result.streamResult.fullStream) {
        const elapsed = Date.now() - streamStart;

        if (part.type === 'text-delta') {
          if (textChunks === 0) {
            this.logger.log(`[stream] First text chunk at +${elapsed}ms`);
          }
          textChunks++;
          fullText += part.text;
          res.write(`0:${JSON.stringify(part.text)}\n`);
        } else if (part.type === 'tool-call') {
          this.logger.log(
            `[stream] Tool call: ${part.toolName} at +${elapsed}ms args=${JSON.stringify(part.input).slice(0, 1000)}`
          );
        } else if (part.type === 'tool-result') {
          const resultStr = JSON.stringify(part.output).slice(0, 500);
          this.logger.log(
            `[stream] Tool result: ${part.toolName} OK at +${elapsed}ms → ${resultStr}`
          );
        } else if (part.type === 'tool-error') {
          this.logger.error(
            `[stream] Tool ERROR: ${part.toolName} at +${elapsed}ms error=${part.error instanceof Error ? part.error.message : JSON.stringify(part.error)} args=${JSON.stringify(part.input).slice(0, 500)}`
          );
        } else if (part.type === 'error') {
          this.logger.error(
            `[stream] Stream ERROR at +${elapsed}ms: ${part.error instanceof Error ? part.error.message : JSON.stringify(part.error)}`
          );
        } else if (part.type === 'finish-step') {
          stepCount++;
          this.logger.log(
            `[stream] Step ${stepCount} finished at +${elapsed}ms (${textChunks} text chunks)`
          );
        } else if (
          part.type === 'tool-input-start' ||
          part.type === 'tool-input-delta' ||
          part.type === 'tool-input-end'
        ) {
          // Suppress noisy streaming events
        } else if (part.type === 'text-start' || part.type === 'text-end') {
          // Suppress text boundary events
        }
      }

      // Save assistant message after stream completes
      await result.saveAssistant(fullText);

      this.logger.log(
        `[stream] Complete at +${Date.now() - streamStart}ms, ${textChunks} text chunks total`
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
}
