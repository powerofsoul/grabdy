import { dbIdSchema } from '@grabdy/common';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { canvasStateSchema } from '../schemas/canvas.js';
import { chatSourceSchema } from './chat.contract.js';

const c = initContract();

const chatMessageSnapshotSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  sources: z.array(chatSourceSchema).nullable(),
  createdAt: z.string(),
});

const sharedChatSchema = z.object({
  id: dbIdSchema('SharedChat'),
  threadId: dbIdSchema('ChatThread'),
  title: z.string().nullable(),
  shareToken: z.string(),
  isPublic: z.boolean(),
  revoked: z.boolean(),
  createdAt: z.string(),
});

const sharedChatSnapshotSchema = z.object({
  title: z.string().nullable(),
  messages: z.array(chatMessageSnapshotSchema),
  canvasState: canvasStateSchema.nullable(),
  createdAt: z.string(),
});

export { chatMessageSnapshotSchema, sharedChatSchema, sharedChatSnapshotSchema };

export const sharedChatsContract = c.router(
  {
    createShare: {
      method: 'POST',
      path: '/orgs/:orgId/chat/threads/:threadId/shares',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        threadId: dbIdSchema('ChatThread'),
      }),
      body: z.object({
        isPublic: z.boolean().optional(),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: sharedChatSchema,
        }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    getSharedChat: {
      method: 'GET',
      path: '/shared/:shareToken',
      pathParams: z.object({
        shareToken: z.string(),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: sharedChatSnapshotSchema,
        }),
        401: z.object({ success: z.literal(false), error: z.string() }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    listShares: {
      method: 'GET',
      path: '/orgs/:orgId/chat/threads/:threadId/shares',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        threadId: dbIdSchema('ChatThread'),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: z.array(sharedChatSchema),
        }),
      },
    },
    revokeShare: {
      method: 'PATCH',
      path: '/orgs/:orgId/chat/threads/:threadId/shares/:shareId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        threadId: dbIdSchema('ChatThread'),
        shareId: dbIdSchema('SharedChat'),
      }),
      body: z.object({}),
      responses: {
        200: z.object({ success: z.literal(true) }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
  },
  { pathPrefix: '' }
);
