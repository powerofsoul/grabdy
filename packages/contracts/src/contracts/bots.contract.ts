import { dbIdSchema } from '@grabdy/common';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { chatAttachmentSchema, MAX_CHAT_ATTACHMENTS } from '../schemas/chat-attachment.js';

const c = initContract();

// ── Source config ────────────────────────────────────────────────────────

export const botSourceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('COLLECTION'), collectionId: dbIdSchema('Collection') }),
  z.object({ type: z.literal('DATA_SOURCE'), dataSourceId: dbIdSchema('DataSource') }),
  z.object({ type: z.literal('CONNECTION'), connectionId: dbIdSchema('Connection') }),
  z.object({
    type: z.literal('CONNECTION_RESOURCE'),
    connectionId: dbIdSchema('Connection'),
    githubRepo: z.string(),
  }),
]);

export type BotSource = z.infer<typeof botSourceSchema>;

export const botSourceConfigSchema = z.array(botSourceSchema);

export type BotSourceConfig = z.infer<typeof botSourceConfigSchema>;

// ── Response schemas ─────────────────────────────────────────────────────

const signingKeySchema = z.object({
  id: dbIdSchema('BotSigningKey'),
  name: z.string(),
  fingerprint: z.string(),
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
});

const botSchema = z.object({
  id: dbIdSchema('Bot'),
  name: z.string(),
  dataSourceConfig: botSourceConfigSchema,
  systemPrompt: z.string().nullable(),
  title: z.string().nullable(),
  subtitle: z.string().nullable(),
  placeholder: z.string().nullable(),
  imageUrl: z.string().nullable(),
  accentColor: z.string().nullable(),
  primaryColor: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const botDetailSchema = botSchema.extend({
  signingKeys: z.array(signingKeySchema),
});

const signingKeyWithSecretSchema = z.object({
  id: dbIdSchema('BotSigningKey'),
  name: z.string(),
  fingerprint: z.string(),
  privateKey: z.string(),
  createdAt: z.string(),
});

// ── Contract ─────────────────────────────────────────────────────────────

export const botsContract = c.router(
  {
    create: {
      method: 'POST',
      path: '/orgs/:orgId/bots',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      body: z.object({
        name: z.string().min(1, 'Name is required'),
        dataSourceConfig: botSourceConfigSchema.optional().default([]),
        systemPrompt: z.string().nullable().optional(),
        title: z.string().nullable().optional(),
        subtitle: z.string().nullable().optional(),
        placeholder: z.string().nullable().optional(),
        accentColor: z.string().nullable().optional(),
        primaryColor: z.string().nullable().optional(),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: botSchema }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },

    list: {
      method: 'GET',
      path: '/orgs/:orgId/bots',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      responses: {
        200: z.object({ success: z.literal(true), data: z.array(botSchema) }),
      },
    },

    get: {
      method: 'GET',
      path: '/orgs/:orgId/bots/:botId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        botId: dbIdSchema('Bot'),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: botDetailSchema }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },

    update: {
      method: 'PATCH',
      path: '/orgs/:orgId/bots/:botId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        botId: dbIdSchema('Bot'),
      }),
      body: z.object({
        name: z.string().min(1, 'Name is required').optional(),
        dataSourceConfig: botSourceConfigSchema.optional(),
        systemPrompt: z.string().nullable().optional(),
        title: z.string().nullable().optional(),
        subtitle: z.string().nullable().optional(),
        placeholder: z.string().nullable().optional(),
        accentColor: z.string().nullable().optional(),
        primaryColor: z.string().nullable().optional(),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: botSchema }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },

    delete: {
      method: 'DELETE',
      path: '/orgs/:orgId/bots/:botId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        botId: dbIdSchema('Bot'),
      }),
      body: z.object({}),
      responses: {
        200: z.object({ success: z.literal(true) }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },

    uploadImage: {
      method: 'POST',
      path: '/orgs/:orgId/bots/:botId/image',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        botId: dbIdSchema('Bot'),
      }),
      contentType: 'multipart/form-data',
      body: c.type<{ file: File }>(),
      responses: {
        200: z.object({ success: z.literal(true), data: z.object({ imageUrl: z.string() }) }),
        400: z.object({ success: z.literal(false), error: z.string() }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },

    deleteImage: {
      method: 'DELETE',
      path: '/orgs/:orgId/bots/:botId/image',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        botId: dbIdSchema('Bot'),
      }),
      body: z.object({}),
      responses: {
        200: z.object({ success: z.literal(true) }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },

    generateSigningKey: {
      method: 'POST',
      path: '/orgs/:orgId/bots/:botId/signing-keys',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        botId: dbIdSchema('Bot'),
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
      path: '/orgs/:orgId/bots/:botId/signing-keys',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        botId: dbIdSchema('Bot'),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: z.array(signingKeySchema) }),
      },
    },

    revokeSigningKey: {
      method: 'DELETE',
      path: '/orgs/:orgId/bots/:botId/signing-keys/:keyId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        botId: dbIdSchema('Bot'),
        keyId: dbIdSchema('BotSigningKey'),
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

// ── SDK streaming (public, JWT-authed) ───────────────────────────────────

export const sdkStreamBodySchema = z.object({
  message: z.string().min(1, 'Message is required'),
  threadId: dbIdSchema('ChatThread').optional(),
  attachments: z.array(chatAttachmentSchema).max(MAX_CHAT_ATTACHMENTS).optional(),
});

export type SdkStreamBody = z.infer<typeof sdkStreamBodySchema>;
