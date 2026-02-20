import { z } from 'zod';

import { chunkMetaTypeEnum } from './chunk-meta.js';

const typeEqFilter = z.object({
  field: z.literal('type'),
  operator: z.literal('eq'),
  value: chunkMetaTypeEnum,
});

const typeInFilter = z.object({
  field: z.literal('type'),
  operator: z.literal('in'),
  value: z.array(chunkMetaTypeEnum),
});

export const metadataFilterSchema = z.union([
  typeEqFilter,
  typeInFilter,
  z.object({
    field: z.literal('slackChannelId'),
    operator: z.literal('eq'),
    value: z.string(),
  }),
  z.object({
    field: z.literal('slackAuthors'),
    operator: z.literal('eq'),
    value: z.string(),
  }),
  z.object({
    field: z.literal('notionPageId'),
    operator: z.literal('eq'),
    value: z.string(),
  }),
  z.object({
    field: z.literal('linearIssueId'),
    operator: z.literal('eq'),
    value: z.string(),
  }),
]);

export type MetadataFilter = z.infer<typeof metadataFilterSchema>;
