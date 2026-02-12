import { Body, Controller, Logger, NotFoundException, Param, Post, Res } from '@nestjs/common';

import { type DbId, dbIdSchema } from '@grabdy/common';
import { retrievalContract, streamChatBodySchema } from '@grabdy/contracts';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Response } from 'express';
import type { z } from 'zod';

type StreamChatBody = z.infer<typeof streamChatBodySchema>;

import {
  CurrentMembership,
  JwtMembership,
} from '../../common/decorators/current-membership.decorator';
import { OrgAccess } from '../../common/decorators/org-roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

import { RetrievalService } from './retrieval.service';

@Controller()
export class RetrievalController {
  private readonly logger = new Logger(RetrievalController.name);

  constructor(private retrievalService: RetrievalService) {}

  @OrgAccess(retrievalContract.query, { params: ['orgId'] })
  @TsRestHandler(retrievalContract.query)
  async query() {
    return tsRestHandler(retrievalContract.query, async ({ params, body }) => {
      try {
        const result = await this.retrievalService.query(params.orgId, body.query, {
          collectionId: body.collectionId,
          limit: body.limit,
        });
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
            error: error instanceof Error ? error.message : 'Query failed',
          },
        };
      }
    });
  }

  @OrgAccess(retrievalContract.chat, { params: ['orgId'] })
  @TsRestHandler(retrievalContract.chat)
  async chat(@CurrentMembership() membership: JwtMembership) {
    return tsRestHandler(retrievalContract.chat, async ({ params, body }) => {
      try {
        const result = await this.retrievalService.chat(params.orgId, membership.id, body.message, {
          threadId: body.threadId,
          collectionId: body.collectionId,
        });

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

  @OrgAccess(retrievalContract.createThread, { params: ['orgId'] })
  @TsRestHandler(retrievalContract.createThread)
  async createThread(@CurrentMembership() membership: JwtMembership) {
    return tsRestHandler(retrievalContract.createThread, async ({ params, body }) => {
      try {
        const thread = await this.retrievalService.createThread(params.orgId, membership.id, {
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

  @OrgAccess(retrievalContract.listThreads, { params: ['orgId'] })
  @TsRestHandler(retrievalContract.listThreads)
  async listThreads(@CurrentMembership() membership: JwtMembership) {
    return tsRestHandler(retrievalContract.listThreads, async ({ params }) => {
      const threads = await this.retrievalService.listThreads(params.orgId, membership.id);

      return {
        status: 200 as const,
        body: { success: true as const, data: threads },
      };
    });
  }

  @OrgAccess(retrievalContract.getThread, { params: ['orgId'] })
  @TsRestHandler(retrievalContract.getThread)
  async getThread() {
    return tsRestHandler(retrievalContract.getThread, async ({ params }) => {
      try {
        const thread = await this.retrievalService.getThread(params.orgId, params.threadId);

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

  @OrgAccess(retrievalContract.deleteThread, { params: ['orgId'] })
  @TsRestHandler(retrievalContract.deleteThread)
  async deleteThread() {
    return tsRestHandler(retrievalContract.deleteThread, async ({ params }) => {
      try {
        await this.retrievalService.deleteThread(params.orgId, params.threadId);

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

  @OrgAccess(retrievalContract.renameThread, { params: ['orgId'] })
  @TsRestHandler(retrievalContract.renameThread)
  async renameThread() {
    return tsRestHandler(retrievalContract.renameThread, async ({ params, body }) => {
      try {
        const thread = await this.retrievalService.renameThread(
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

  @OrgAccess(retrievalContract.moveCanvasCard, { params: ['orgId'] })
  @TsRestHandler(retrievalContract.moveCanvasCard)
  async moveCanvasCard() {
    return tsRestHandler(retrievalContract.moveCanvasCard, async ({ params, body }) => {
      try {
        const canvasState = await this.retrievalService.moveCanvasCard(
          params.orgId,
          params.threadId,
          params.cardId,
          body
        );
        return { status: 200 as const, body: { success: true as const, canvasState } };
      } catch (error) {
        if (error instanceof NotFoundException) {
          return { status: 404 as const, body: { success: false as const, error: error.message } };
        }
        throw error;
      }
    });
  }

  @OrgAccess(retrievalContract.updateCanvasEdges, { params: ['orgId'] })
  @TsRestHandler(retrievalContract.updateCanvasEdges)
  async updateCanvasEdges() {
    return tsRestHandler(retrievalContract.updateCanvasEdges, async ({ params, body }) => {
      try {
        const canvasState = await this.retrievalService.updateCanvasEdges(
          params.orgId,
          params.threadId,
          body.edges
        );
        return { status: 200 as const, body: { success: true as const, canvasState } };
      } catch (error) {
        if (error instanceof NotFoundException) {
          return { status: 404 as const, body: { success: false as const, error: error.message } };
        }
        throw error;
      }
    });
  }

  @OrgAccess(retrievalContract.deleteCanvasCard, { params: ['orgId'] })
  @TsRestHandler(retrievalContract.deleteCanvasCard)
  async deleteCanvasCard() {
    return tsRestHandler(retrievalContract.deleteCanvasCard, async ({ params }) => {
      try {
        const canvasState = await this.retrievalService.deleteCanvasCard(
          params.orgId,
          params.threadId,
          params.cardId
        );
        return { status: 200 as const, body: { success: true as const, canvasState } };
      } catch (error) {
        if (error instanceof NotFoundException) {
          return { status: 404 as const, body: { success: false as const, error: error.message } };
        }
        throw error;
      }
    });
  }

  @OrgAccess(retrievalContract.addCanvasEdge, { params: ['orgId'] })
  @TsRestHandler(retrievalContract.addCanvasEdge)
  async addCanvasEdge() {
    return tsRestHandler(retrievalContract.addCanvasEdge, async ({ params, body }) => {
      try {
        const canvasState = await this.retrievalService.addCanvasEdge(
          params.orgId,
          params.threadId,
          body.edge
        );
        return { status: 200 as const, body: { success: true as const, canvasState } };
      } catch (error) {
        if (error instanceof NotFoundException) {
          return { status: 404 as const, body: { success: false as const, error: error.message } };
        }
        throw error;
      }
    });
  }

  @OrgAccess(retrievalContract.deleteCanvasEdge, { params: ['orgId'] })
  @TsRestHandler(retrievalContract.deleteCanvasEdge)
  async deleteCanvasEdge() {
    return tsRestHandler(retrievalContract.deleteCanvasEdge, async ({ params }) => {
      try {
        const canvasState = await this.retrievalService.deleteCanvasEdge(
          params.orgId,
          params.threadId,
          params.edgeId
        );
        return { status: 200 as const, body: { success: true as const, canvasState } };
      } catch (error) {
        if (error instanceof NotFoundException) {
          return { status: 404 as const, body: { success: false as const, error: error.message } };
        }
        throw error;
      }
    });
  }

  @OrgAccess(retrievalContract.updateCanvasComponent, { params: ['orgId'] })
  @TsRestHandler(retrievalContract.updateCanvasComponent)
  async updateCanvasComponent() {
    return tsRestHandler(retrievalContract.updateCanvasComponent, async ({ params, body }) => {
      try {
        const canvasState = await this.retrievalService.updateCanvasComponent(
          params.orgId,
          params.threadId,
          params.cardId,
          params.componentId,
          body.data
        );
        return { status: 200 as const, body: { success: true as const, canvasState } };
      } catch (error) {
        if (error instanceof NotFoundException) {
          return { status: 404 as const, body: { success: false as const, error: error.message } };
        }
        throw error;
      }
    });
  }

  @OrgAccess(retrievalContract.addCanvasCard, { params: ['orgId'] })
  @TsRestHandler(retrievalContract.addCanvasCard)
  async addCanvasCard() {
    return tsRestHandler(retrievalContract.addCanvasCard, async ({ params, body }) => {
      try {
        const canvasState = await this.retrievalService.addCanvasCard(
          params.orgId,
          params.threadId,
          body.card
        );
        return { status: 200 as const, body: { success: true as const, canvasState } };
      } catch (error) {
        if (error instanceof NotFoundException) {
          return { status: 404 as const, body: { success: false as const, error: error.message } };
        }
        throw error;
      }
    });
  }

  @OrgAccess({ params: ['orgId'] })
  @Post('/api/orgs/:orgId/chat/stream')
  async streamChat(
    @Param('orgId', new ZodValidationPipe(dbIdSchema('Org')))
    orgId: DbId<'Org'>,
    @CurrentMembership() membership: JwtMembership,
    @Body(new ZodValidationPipe(streamChatBodySchema)) body: StreamChatBody,
    @Res() res: Response
  ) {
    try {
      const result = await this.retrievalService.streamChat(orgId, membership.id, body.message, {
        threadId: body.threadId,
        collectionId: body.collectionId,
      });

      // AI SDK v5 data stream protocol
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Vercel-AI-Data-Stream', 'v1');
      res.flushHeaders();

      const canvasToolNames = new Set([
        'canvas_add_card',
        'canvas_remove_card',
        'canvas_move_card',
        'canvas_update_component',
        'canvas_add_edge',
        'canvas_remove_edge',
      ]);

      const streamStart = Date.now();
      let textChunks = 0;

      const reader = result.streamResult.fullStream.getReader();
      try {
        while (true) {
          const { done, value: part } = await reader.read();
          if (done) break;
          if (!part) continue;

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
              `[stream] Tool call: ${payload.toolName} at +${Date.now() - streamStart}ms args=${JSON.stringify(payload.args).slice(0, 200)}`
            );
          } else if (part.type === 'tool-result') {
            const payload = part.payload;
            const resultPreview = JSON.stringify(payload.result).slice(0, 300);
            this.logger.log(
              `[stream] Tool result: ${payload.toolName} at +${Date.now() - streamStart}ms result=${resultPreview}`
            );
            if (canvasToolNames.has(payload.toolName)) {
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
      } finally {
        reader.releaseLock();
      }

      this.logger.log(
        `[stream] Complete at +${Date.now() - streamStart}ms, ${textChunks} text chunks total`
      );

      // Send done metadata
      res.write(
        `8:${JSON.stringify({
          type: 'done',
          threadId: result.threadId,
          sources: [],
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
