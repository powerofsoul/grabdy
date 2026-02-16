import { z } from 'zod';

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
export const chunkMetaSchema = z.discriminatedUnion('type', [
  pdfChunkMetaSchema, docxChunkMetaSchema, xlsxChunkMetaSchema,
  csvChunkMetaSchema, txtChunkMetaSchema, jsonChunkMetaSchema, imageChunkMetaSchema,
  slackChunkMetaSchema,
]);

export type ChunkMeta = z.infer<typeof chunkMetaSchema>;

/** Enum of all chunk metadata type discriminants. */
export const chunkMetaTypeEnum = z.enum(['PDF', 'DOCX', 'XLSX', 'CSV', 'TXT', 'JSON', 'IMAGE', 'SLACK']);
export type ChunkMetaType = z.infer<typeof chunkMetaTypeEnum>;
