import { dbIdSchema } from '@grabdy/common';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import type { DataSourceType } from '../enums/data-source.js';
import { chatAttachmentSchema, MAX_CHAT_ATTACHMENTS } from '../schemas/chat-attachment.js';

// ── Data source config (for scoping chat to specific sources) ────────────

export const dataSourceConfigEntrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('COLLECTION'), collectionId: dbIdSchema('Collection') }),
  z.object({ type: z.literal('DATA_SOURCE'), dataSourceId: dbIdSchema('DataSource') }),
]);

export type DataSourceConfigEntry = z.infer<typeof dataSourceConfigEntrySchema>;

export const dataSourceConfigSchema = z.array(dataSourceConfigEntrySchema);

export type DataSourceConfig = z.infer<typeof dataSourceConfigSchema>;

const c = initContract();

const chatSourceBase = {
  ref: z.number().optional(),
  dataSourceId: dbIdSchema('DataSource'),
  dataSourceName: z.string(),
  score: z.number(),
  sourceUrl: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  content: z.string().optional(),
};

export const chatSourceSchema = z.discriminatedUnion('type', [
  z.object({
    ...chatSourceBase,
    type: z.literal('PDF'),
    pages: z.array(z.number()),
  }),
  z.object({
    ...chatSourceBase,
    type: z.literal('DOCX'),
    pages: z.array(z.number()),
  }),
  z.object({
    ...chatSourceBase,
    type: z.literal('XLSX'),
    sheet: z.string(),
    rows: z.array(z.number()),
    columns: z.array(z.string()),
  }),
  z.object({
    ...chatSourceBase,
    type: z.literal('CSV'),
    rows: z.array(z.number()),
    columns: z.array(z.string()),
  }),
  z.object({ ...chatSourceBase, type: z.literal('TXT') }),
  z.object({ ...chatSourceBase, type: z.literal('JSON') }),
  z.object({ ...chatSourceBase, type: z.literal('IMAGE') }),
  z.object({ ...chatSourceBase, type: z.literal('EMAIL') }),
]);

export type ChatSource = z.infer<typeof chatSourceSchema>;

// Compile-time: ChatSource['type'] must exactly match DataSourceType
type _AssertChatSourceExhaustive = [DataSourceType] extends [ChatSource['type']]
  ? [ChatSource['type']] extends [DataSourceType]
    ? true
    : never
  : never;
const _chatSourceCheck: _AssertChatSourceExhaustive = true;
void _chatSourceCheck;

// ---------------------------------------------------------------------------
// SSE stream event schemas (shared between API and frontend)
// ---------------------------------------------------------------------------

const sseThinkingEventSchema = z.object({
  type: z.literal('thinking'),
  text: z.string(),
});

const sseSourcesEventSchema = z.object({
  type: z.literal('sources'),
  sources: z.array(chatSourceSchema),
});

const sseTextDoneEventSchema = z.object({
  type: z.literal('text_done'),
});

const sseDoneEventSchema = z.object({
  type: z.literal('done'),
  threadId: z.string().nullable(),
  durationMs: z.number(),
  finishReason: z.string().optional(),
});

export const sseMetaEventSchema = z.discriminatedUnion('type', [
  sseThinkingEventSchema,
  sseSourcesEventSchema,
  sseTextDoneEventSchema,
  sseDoneEventSchema,
]);

export type SseMetaEvent = z.infer<typeof sseMetaEventSchema>;

// ---------------------------------------------------------------------------
// Stream chunks emitted by tool hooks (text delta, thinking, sources)
// ---------------------------------------------------------------------------

export const streamChunkSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }),
  sseThinkingEventSchema,
  sseSourcesEventSchema,
]);

export type StreamChunk = z.infer<typeof streamChunkSchema>;

const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  sources: z.array(chatSourceSchema).nullable(),
  thinkingTexts: z.array(z.string()).nullable(),
  durationMs: z.number().nullable(),
  attachments: z.array(chatAttachmentSchema).nullable(),
  createdAt: z.string(),
});

const threadSchema = z.object({
  id: dbIdSchema('ChatThread'),
  title: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const threadWithMessagesSchema = threadSchema.extend({
  messages: z.array(chatMessageSchema),
});

export const chatContract = c.router(
  {
    createThread: {
      method: 'POST',
      path: '/orgs/:orgId/chat/threads',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      body: z.object({
        title: z.string().optional(),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: threadSchema }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    listThreads: {
      method: 'GET',
      path: '/orgs/:orgId/chat/threads',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      query: z.object({}),
      responses: {
        200: z.object({ success: z.literal(true), data: z.array(threadSchema) }),
      },
    },
    getThread: {
      method: 'GET',
      path: '/orgs/:orgId/chat/threads/:threadId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        threadId: dbIdSchema('ChatThread'),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: threadWithMessagesSchema }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    deleteThread: {
      method: 'DELETE',
      path: '/orgs/:orgId/chat/threads/:threadId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        threadId: dbIdSchema('ChatThread'),
      }),
      body: z.object({}),
      responses: {
        200: z.object({ success: z.literal(true) }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    renameThread: {
      method: 'PATCH',
      path: '/orgs/:orgId/chat/threads/:threadId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        threadId: dbIdSchema('ChatThread'),
      }),
      body: z.object({ title: z.string().min(1) }),
      responses: {
        200: z.object({ success: z.literal(true), data: threadSchema }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
  },
  { pathPrefix: '' }
);

/**
 * Zod schema for the streaming chat endpoint body.
 * This endpoint uses raw Express SSE (ts-rest doesn't support streaming),
 * so the schema is exported standalone for manual validation.
 */
export const streamChatBodySchema = z.object({
  message: z.string().min(1),
  threadId: dbIdSchema('ChatThread').optional(),
  dataSourceConfig: dataSourceConfigSchema.optional(),
  attachments: z.array(chatAttachmentSchema).max(MAX_CHAT_ATTACHMENTS).optional(),
});
