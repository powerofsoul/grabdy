import { Body, Controller, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';

import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

import { dbIdSchema, extractOrgNumericId } from '@grabdy/common';
import { retrievalContract } from '@grabdy/contracts';

import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { OrgAccess } from '../../common/decorators/org-roles.decorator';

import { RetrievalService } from './retrieval.service';

@Controller()
export class RetrievalController {
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
  async chat(@CurrentUser() user: JwtPayload) {
    return tsRestHandler(retrievalContract.chat, async ({ params, body }) => {
      try {
        const orgNum = extractOrgNumericId(params.orgId);
        const membership = user.memberships.find((m) => extractOrgNumericId(m.id) === orgNum);

        if (!membership) {
          return {
            status: 400 as const,
            body: { success: false as const, error: 'No membership found' },
          };
        }

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

  @OrgAccess(retrievalContract.listThreads, { params: ['orgId'] })
  @TsRestHandler(retrievalContract.listThreads)
  async listThreads(@CurrentUser() user: JwtPayload) {
    return tsRestHandler(retrievalContract.listThreads, async ({ params }) => {
      const orgNum = extractOrgNumericId(params.orgId);
      const membership = user.memberships.find((m) => extractOrgNumericId(m.id) === orgNum);

      if (!membership) {
        return {
          status: 200 as const,
          body: { success: true as const, data: [] },
        };
      }

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
          body.title,
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
  @Post('/api/orgs/:orgId/chat/stream')
  async streamChat(
    @Param('orgId') orgIdRaw: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { message: string; threadId?: string; collectionId?: string },
    @Res() res: Response,
  ) {
    const orgIdResult = dbIdSchema('Org').safeParse(orgIdRaw);
    if (!orgIdResult.success) {
      res.status(400).json({ success: false, error: 'Invalid org ID' });
      return;
    }
    const orgId = orgIdResult.data;

    const orgNum = extractOrgNumericId(orgId);
    const membership = user.memberships.find((m) => extractOrgNumericId(m.id) === orgNum);

    if (!membership) {
      res.status(400).json({ success: false, error: 'No membership found' });
      return;
    }

    const threadIdResult = body.threadId
      ? dbIdSchema('ChatThread').safeParse(body.threadId)
      : undefined;
    if (threadIdResult && !threadIdResult.success) {
      res.status(400).json({ success: false, error: 'Invalid thread ID' });
      return;
    }

    const collectionIdResult = body.collectionId
      ? dbIdSchema('Collection').safeParse(body.collectionId)
      : undefined;
    if (collectionIdResult && !collectionIdResult.success) {
      res.status(400).json({ success: false, error: 'Invalid collection ID' });
      return;
    }

    try {
      const result = await this.retrievalService.streamChat(orgId, membership.id, body.message, {
        threadId: threadIdResult?.data,
        collectionId: collectionIdResult?.data,
      });

      // AI SDK v5 data stream protocol
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Vercel-AI-Data-Stream', 'v1');
      res.flushHeaders();

      for await (const chunk of result.streamResult.textStream) {
        res.write(`0:${JSON.stringify(chunk)}\n`);
      }

      // Send done metadata
      res.write(
        `8:${JSON.stringify({
          type: 'done',
          threadId: result.threadId,
          sources: [],
        })}\n`,
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
