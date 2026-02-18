import { Body, Controller, Logger, Param, Post, Res } from '@nestjs/common';

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

const CANVAS_TOOL_NAME_SET = new Set(['canvas_update']);

@Controller()
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private chatService: ChatService) {}

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

  @OrgAccess(chatContract.moveCanvasCard, { params: ['orgId'] })
  @TsRestHandler(chatContract.moveCanvasCard)
  async moveCanvasCard() {
    return tsRestHandler(chatContract.moveCanvasCard, async ({ params, body }) => {
      await this.chatService.moveCanvasCard(params.orgId, params.threadId, params.cardId, body);
      return { status: 200 as const, body: { success: true as const } };
    });
  }

  @OrgAccess(chatContract.updateCanvasEdges, { params: ['orgId'] })
  @TsRestHandler(chatContract.updateCanvasEdges)
  async updateCanvasEdges() {
    return tsRestHandler(chatContract.updateCanvasEdges, async ({ params, body }) => {
      await this.chatService.updateCanvasEdges(params.orgId, params.threadId, body.edges);
      return { status: 200 as const, body: { success: true as const } };
    });
  }

  @OrgAccess(chatContract.deleteCanvasCard, { params: ['orgId'] })
  @TsRestHandler(chatContract.deleteCanvasCard)
  async deleteCanvasCard() {
    return tsRestHandler(chatContract.deleteCanvasCard, async ({ params }) => {
      await this.chatService.deleteCanvasCard(params.orgId, params.threadId, params.cardId);
      return { status: 200 as const, body: { success: true as const } };
    });
  }

  @OrgAccess(chatContract.addCanvasEdge, { params: ['orgId'] })
  @TsRestHandler(chatContract.addCanvasEdge)
  async addCanvasEdge() {
    return tsRestHandler(chatContract.addCanvasEdge, async ({ params, body }) => {
      await this.chatService.addCanvasEdge(params.orgId, params.threadId, body.edge);
      return { status: 200 as const, body: { success: true as const } };
    });
  }

  @OrgAccess(chatContract.deleteCanvasEdge, { params: ['orgId'] })
  @TsRestHandler(chatContract.deleteCanvasEdge)
  async deleteCanvasEdge() {
    return tsRestHandler(chatContract.deleteCanvasEdge, async ({ params }) => {
      await this.chatService.deleteCanvasEdge(params.orgId, params.threadId, params.edgeId);
      return { status: 200 as const, body: { success: true as const } };
    });
  }

  @OrgAccess(chatContract.updateCanvasComponent, { params: ['orgId'] })
  @TsRestHandler(chatContract.updateCanvasComponent)
  async updateCanvasComponent() {
    return tsRestHandler(chatContract.updateCanvasComponent, async ({ params, body }) => {
      await this.chatService.updateCanvasComponent(
        params.orgId,
        params.threadId,
        params.cardId,
        params.componentId,
        body.data
      );
      return { status: 200 as const, body: { success: true as const } };
    });
  }

  @OrgAccess(chatContract.addCanvasCard, { params: ['orgId'] })
  @TsRestHandler(chatContract.addCanvasCard)
  async addCanvasCard() {
    return tsRestHandler(chatContract.addCanvasCard, async ({ params, body }) => {
      await this.chatService.addCanvasCard(params.orgId, params.threadId, body.card);
      return { status: 200 as const, body: { success: true as const } };
    });
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
      const result = await this.chatService.streamChat(orgId, membership.id, userId, body.message, {
        threadId: body.threadId,
        collectionId: body.collectionId,
      });

      // AI SDK v5 data stream protocol
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Vercel-AI-Data-Stream', 'v1');
      res.flushHeaders();

      const streamStart = Date.now();
      let textChunks = 0;

      for await (const part of result.streamResult.fullStream) {
        if (part.type === 'text-delta') {
          const payload = part.payload;
          if (textChunks === 0) {
            this.logger.log(`[stream] First text chunk at +${Date.now() - streamStart}ms`);
          }
          textChunks++;
          res.write(`0:${JSON.stringify(payload.text)}\n`);
        } else if (part.type === 'tool-call') {
          const payload = part.payload;
          this.logger.log(
            `[stream] Tool call: ${payload.toolName} at +${Date.now() - streamStart}ms`
          );
        } else if (part.type === 'tool-result') {
          const payload = part.payload;
          this.logger.log(
            `[stream] Tool result: ${payload.toolName} at +${Date.now() - streamStart}ms`
          );
          if (CANVAS_TOOL_NAME_SET.has(payload.toolName)) {
            res.write(
              `8:${JSON.stringify({
                type: 'canvas_update',
                tool: payload.toolName,
                args: payload.args,
                result: payload.result,
              })}\n`
            );
          }
        } else if (part.type === 'step-finish') {
          this.logger.log(
            `[stream] Step finished at +${Date.now() - streamStart}ms (${textChunks} text chunks so far)`
          );
        } else {
          this.logger.debug(`[stream] ${part.type} at +${Date.now() - streamStart}ms`);
        }
      }

      this.logger.log(
        `[stream] Complete at +${Date.now() - streamStart}ms, ${textChunks} text chunks total`
      );

      res.write(
        `8:${JSON.stringify({
          type: 'done',
          threadId: result.threadId,
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
