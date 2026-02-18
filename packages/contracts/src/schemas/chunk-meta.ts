import { z } from 'zod';

import type { DataSourceType } from '../enums/data-source.js';
import { dataSourceTypeEnum } from '../enums/data-source.js';

// Upload types — location within a file
const pdfChunkMetaSchema = z.object({
  type: z.literal('PDF'),
  pages: z.array(z.number()),
});

const docxChunkMetaSchema = z.object({
  type: z.literal('DOCX'),
  pages: z.array(z.number()),
});

const xlsxChunkMetaSchema = z.object({
  type: z.literal('XLSX'),
  sheet: z.string(),
  row: z.number(),
  columns: z.array(z.string()),
});

const csvChunkMetaSchema = z.object({
  type: z.literal('CSV'),
  row: z.number(),
  columns: z.array(z.string()),
});

const txtChunkMetaSchema = z.object({ type: z.literal('TXT') });
const jsonChunkMetaSchema = z.object({ type: z.literal('JSON') });
const imageChunkMetaSchema = z.object({ type: z.literal('IMAGE') });

// Integration types — location within external system
const slackChunkMetaSchema = z.object({
  type: z.literal('SLACK'),
  slackChannelId: z.string(),
  slackMessageTs: z.string(),
  slackAuthor: z.string(),
});

const linearChunkMetaSchema = z.object({
  type: z.literal('LINEAR'),
  linearIssueId: z.string(),
  linearCommentId: z.string().nullable(),
  linearTimestamp: z.string().nullable().optional(),
});

const githubChunkMetaSchema = z.object({
  type: z.literal('GITHUB'),
  githubItemType: z.enum(['issue', 'pull_request', 'discussion']),
  githubCommentId: z.string().nullable(),
});

const notionChunkMetaSchema = z.object({
  type: z.literal('NOTION'),
  notionPageId: z.string(),
  notionBlockId: z.string().nullable(),
});

export const chunkMetaSchema = z.discriminatedUnion('type', [
  pdfChunkMetaSchema,
  docxChunkMetaSchema,
  xlsxChunkMetaSchema,
  csvChunkMetaSchema,
  txtChunkMetaSchema,
  jsonChunkMetaSchema,
  imageChunkMetaSchema,
  slackChunkMetaSchema,
  linearChunkMetaSchema,
  githubChunkMetaSchema,
  notionChunkMetaSchema,
]);

export type ChunkMeta = z.infer<typeof chunkMetaSchema>;

/** Enum of all chunk metadata type discriminants — derived from DataSourceType. */
export const chunkMetaTypeEnum = dataSourceTypeEnum;
export type ChunkMetaType = z.infer<typeof chunkMetaTypeEnum>;

// Compile-time: ChunkMeta['type'] must exactly match DataSourceType
type _AssertChunkMetaExhaustive = [DataSourceType] extends [ChunkMeta['type']]
  ? [ChunkMeta['type']] extends [DataSourceType]
    ? true
    : never
  : never;
const _chunkMetaCheck: _AssertChunkMetaExhaustive = true;
void _chunkMetaCheck;

/**
 * Human-readable description of metadata fields per chunk type.
 * Keyed on DataSourceType so TypeScript errors when a new type is added without a description.
 * Used by the RAG search tool to tell the LLM what metadata fields are available.
 */
export const CHUNK_META_DESCRIPTIONS: Record<DataSourceType, string> = {
  PDF: '{ type, pages[] }',
  DOCX: '{ type, pages[] }',
  XLSX: '{ type, sheet, row, columns[] }',
  CSV: '{ type, row, columns[] }',
  TXT: '{ type }',
  JSON: '{ type }',
  IMAGE: '{ type }',
  SLACK: '{ type, slackChannelId, slackMessageTs, slackAuthor }',
  LINEAR: '{ type, linearIssueId, linearCommentId, linearTimestamp }',
  GITHUB: '{ type, githubItemType (issue|pull_request|discussion), githubCommentId }',
  NOTION: '{ type, notionPageId, notionBlockId }',
};
