import { dbIdSchema } from '@grabdy/common';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { chatAttachmentSchema, MAX_CHAT_ATTACHMENTS } from '../schemas/chat-attachment.js';

const c = initContract();

// ── Source config ────────────────────────────────────────────────────────

const sdkChatSourceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('COLLECTION'), collectionId: dbIdSchema('Collection') }),
  z.object({ type: z.literal('DATA_SOURCE'), dataSourceId: dbIdSchema('DataSource') }),
]);

export type SdkChatSource = z.infer<typeof sdkChatSourceSchema>;

export const sdkChatSourceConfigSchema = z.array(sdkChatSourceSchema);

export type SdkChatSourceConfig = z.infer<typeof sdkChatSourceConfigSchema>;

// ── Style (SDK-level only, not stored in DB) ────────────────────────────

export const sdkChatStyleSchema = z.object({
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  logoUrl: z.string().optional(),
  bubbleImageUrl: z.string().optional(),
  title: z.string().optional(),
  placeholder: z.string().optional(),
  welcomeMessage: z.string().optional(),
});

export type SdkChatStyle = z.infer<typeof sdkChatStyleSchema>;

// ── Response schemas ─────────────────────────────────────────────────────

const signingKeySchema = z.object({
  id: dbIdSchema('SdkSigningKey'),
  name: z.string(),
  fingerprint: z.string(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
});

const sdkChatSchema = z.object({
  id: dbIdSchema('SdkChat'),
  name: z.string(),
  dataSourceConfig: sdkChatSourceConfigSchema,
  systemPrompt: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const sdkChatDetailSchema = sdkChatSchema.extend({
  signingKeys: z.array(signingKeySchema),
});

const signingKeyWithSecretSchema = z.object({
  id: dbIdSchema('SdkSigningKey'),
  name: z.string(),
  fingerprint: z.string(),
  privateKey: z.string(),
  createdAt: z.string(),
});

// ── Contract ─────────────────────────────────────────────────────────────

export const sdkChatsContract = c.router(
  {
    create: {
      method: 'POST',
      path: '/orgs/:orgId/sdk-chats',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      body: z.object({
        name: z.string().min(1, 'Name is required'),
        dataSourceConfig: sdkChatSourceConfigSchema.optional().default([]),
        systemPrompt: z.string().nullable().optional(),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: sdkChatSchema }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },

    list: {
      method: 'GET',
      path: '/orgs/:orgId/sdk-chats',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      responses: {
        200: z.object({ success: z.literal(true), data: z.array(sdkChatSchema) }),
      },
    },

    get: {
      method: 'GET',
      path: '/orgs/:orgId/sdk-chats/:sdkChatId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        sdkChatId: dbIdSchema('SdkChat'),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: sdkChatDetailSchema }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },

    update: {
      method: 'PATCH',
      path: '/orgs/:orgId/sdk-chats/:sdkChatId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        sdkChatId: dbIdSchema('SdkChat'),
      }),
      body: z.object({
        name: z.string().min(1, 'Name is required').optional(),
        dataSourceConfig: sdkChatSourceConfigSchema.optional(),
        systemPrompt: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: sdkChatSchema }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },

    delete: {
      method: 'DELETE',
      path: '/orgs/:orgId/sdk-chats/:sdkChatId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        sdkChatId: dbIdSchema('SdkChat'),
      }),
      body: z.object({}),
      responses: {
        200: z.object({ success: z.literal(true) }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },

    generateSigningKey: {
      method: 'POST',
      path: '/orgs/:orgId/sdk-chats/:sdkChatId/signing-keys',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        sdkChatId: dbIdSchema('SdkChat'),
      }),
      body: z.object({
        name: z.string().min(1, 'Key name is required').optional().default('default'),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: signingKeyWithSecretSchema }),
        400: z.object({ success: z.literal(false), error: z.string() }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },

    listSigningKeys: {
      method: 'GET',
      path: '/orgs/:orgId/sdk-chats/:sdkChatId/signing-keys',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        sdkChatId: dbIdSchema('SdkChat'),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: z.array(signingKeySchema) }),
      },
    },

    revokeSigningKey: {
      method: 'DELETE',
      path: '/orgs/:orgId/sdk-chats/:sdkChatId/signing-keys/:keyId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        sdkChatId: dbIdSchema('SdkChat'),
        keyId: dbIdSchema('SdkSigningKey'),
      }),
      body: z.object({}),
      responses: {
        200: z.object({ success: z.literal(true) }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },

    generatePreviewJwt: {
      method: 'POST',
      path: '/orgs/:orgId/sdk-chats/:sdkChatId/preview-jwt',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        sdkChatId: dbIdSchema('SdkChat'),
      }),
      body: z.object({}),
      responses: {
        200: z.object({ success: z.literal(true), data: z.object({ jwt: z.string() }) }),
        400: z.object({ success: z.literal(false), error: z.string() }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
  },
  { pathPrefix: '' }
);

// ── SDK streaming (public, JWT-authed) ───────────────────────────────────

export const sdkStreamBodySchema = z.object({
  message: z.string().min(1, 'Message is required'),
  threadId: dbIdSchema('ChatThread').optional(),
  attachments: z.array(chatAttachmentSchema).max(MAX_CHAT_ATTACHMENTS).optional(),
});

export type SdkStreamBody = z.infer<typeof sdkStreamBodySchema>;

export const sdkHistoryMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  attachments: z.array(chatAttachmentSchema).nullable().optional(),
  createdAt: z.string().nullable(),
});

export type SdkHistoryMessage = z.infer<typeof sdkHistoryMessageSchema>;
