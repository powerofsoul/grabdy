import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { openai } from '@ai-sdk/openai';
import { embedMany } from 'ai';
import { Job } from 'bullmq';
import * as fs from 'fs';

import type { DbId } from '@grabdy/common';
import { extractOrgNumericId, packId } from '@grabdy/common';

import { CHUNK_OVERLAP, CHUNK_SIZE, EMBEDDING_BATCH_SIZE, SUMMARY_MAX_LENGTH } from '../../../config/constants';
import { DbService } from '../../../db/db.module';
import { DATA_SOURCE_QUEUE } from '../queue.constants';

export interface DataSourceJobData {
  dataSourceId: DbId<'DataSource'>;
  orgId: DbId<'Org'>;
  storagePath: string;
  mimeType: string;
  collectionId: DbId<'Collection'> | null;
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push(text.slice(start, end));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

@Processor(DATA_SOURCE_QUEUE)
export class DataSourceProcessor extends WorkerHost {
  private readonly logger = new Logger(DataSourceProcessor.name);

  constructor(private db: DbService) {
    super();
  }

  async process(job: Job<DataSourceJobData>): Promise<void> {
    const { dataSourceId, orgId, storagePath, mimeType, collectionId } = job.data;
    this.logger.log(`Processing data source ${dataSourceId}`);

    try {
      // Update status to PROCESSING
      await this.db.kysely
        .updateTable('data.data_sources')
        .set({ status: 'PROCESSING', updated_at: new Date() })
        .where('id', '=', dataSourceId)
        .execute();

      // Extract text based on mime type
      const text = await this.extractText(storagePath, mimeType);
      if (!text.trim()) {
        throw new Error('No text content extracted from file');
      }

      // Chunk the text
      const chunks = chunkText(text);
      this.logger.log(`Split into ${chunks.length} chunks`);

      // Generate embeddings in batches
      const orgNum = extractOrgNumericId(orgId);
      const batchSize = EMBEDDING_BATCH_SIZE;

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);

        const { embeddings } = await embedMany({
          model: openai.embedding('text-embedding-3-small'),
          values: batch,
        });

        // Store chunks with embeddings
        const values = batch.map((content, idx) => ({
          id: packId('Chunk', orgNum),
          content,
          chunk_index: i + idx,
          metadata: null,
          embedding: `[${embeddings[idx].join(',')}]`,
          data_source_id: dataSourceId,
          collection_id: collectionId,
          org_id: orgId,
        }));

        await this.db.kysely
          .insertInto('data.chunks')
          .values(values)
          .execute();

        await job.updateProgress(Math.min(((i + batchSize) / chunks.length) * 100, 100));
      }

      // Update data source status to READY
      await this.db.kysely
        .updateTable('data.data_sources')
        .set({
          status: 'READY',
          page_count: chunks.length,
          summary: text.slice(0, SUMMARY_MAX_LENGTH),
          updated_at: new Date(),
        })
        .where('id', '=', dataSourceId)
        .execute();

      this.logger.log(`Data source ${dataSourceId} processed successfully`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to process data source ${dataSourceId}: ${message}`);

      await this.db.kysely
        .updateTable('data.data_sources')
        .set({ status: 'FAILED', updated_at: new Date() })
        .where('id', '=', dataSourceId)
        .execute();

      throw error;
    }
  }

  private async extractText(storagePath: string, mimeType: string): Promise<string> {
    const buffer = fs.readFileSync(storagePath);

    if (mimeType === 'application/pdf') {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return data.text;
    }

    if (
      mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    if (mimeType === 'text/csv' || mimeType === 'text/plain' || mimeType === 'application/json') {
      return buffer.toString('utf-8');
    }

    throw new Error(`Unsupported mime type: ${mimeType}`);
  }
}
