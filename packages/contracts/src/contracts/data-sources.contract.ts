import { dbIdSchema } from '@grabdy/common';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { dataSourceStatusEnum, dataSourceTypeEnum } from '../enums/index.js';

const c = initContract();

const dataSourceSchema = z.object({
  id: dbIdSchema('DataSource'),
  title: z.string(),
  mimeType: z.string(),
  fileSize: z.number(),
  type: dataSourceTypeEnum,
  status: dataSourceStatusEnum,
  summary: z.string().nullable(),
  pageCount: z.number().nullable(),
  collectionId: dbIdSchema('Collection').nullable(),
  orgId: dbIdSchema('Org'),
  uploadedById: dbIdSchema('User').nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const dataSourcesContract = c.router(
  {
    upload: {
      method: 'POST',
      path: '/orgs/:orgId/data-sources/upload',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      contentType: 'multipart/form-data',
      body: z.object({
        file: z.any(),
        name: z.string().optional(),
        collectionId: z.string().optional(),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: dataSourceSchema }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    list: {
      method: 'GET',
      path: '/orgs/:orgId/data-sources',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      query: z.object({
        collectionId: dbIdSchema('Collection').optional(),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: z.array(dataSourceSchema) }),
      },
    },
    get: {
      method: 'GET',
      path: '/orgs/:orgId/data-sources/:id',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        id: dbIdSchema('DataSource'),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: dataSourceSchema }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    delete: {
      method: 'DELETE',
      path: '/orgs/:orgId/data-sources/:id',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        id: dbIdSchema('DataSource'),
      }),
      body: z.object({}),
      responses: {
        200: z.object({ success: z.literal(true) }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    reprocess: {
      method: 'POST',
      path: '/orgs/:orgId/data-sources/:id/reprocess',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        id: dbIdSchema('DataSource'),
      }),
      body: z.object({}),
      responses: {
        200: z.object({ success: z.literal(true), data: dataSourceSchema }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    rename: {
      method: 'PATCH',
      path: '/orgs/:orgId/data-sources/:id',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        id: dbIdSchema('DataSource'),
      }),
      body: z.object({ title: z.string().min(1).max(255) }),
      responses: {
        200: z.object({ success: z.literal(true), data: dataSourceSchema }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    previewUrl: {
      method: 'GET',
      path: '/orgs/:orgId/data-sources/:id/preview-url',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        id: dbIdSchema('DataSource'),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: z.object({
            url: z.string(),
            mimeType: z.string(),
            title: z.string(),
          }),
        }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    listExtractedImages: {
      method: 'GET',
      path: '/orgs/:orgId/data-sources/:id/images',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        id: dbIdSchema('DataSource'),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: z.array(z.object({
            id: z.string(),
            mimeType: z.string(),
            pageNumber: z.number().nullable(),
            url: z.string(),
            aiDescription: z.string().nullable(),
          })),
        }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
  },
  { pathPrefix: '' }
);
