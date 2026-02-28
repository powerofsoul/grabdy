import { Injectable } from '@nestjs/common';

import { openai } from '@ai-sdk/openai';
import type { DbId } from '@grabdy/common';
import { packId } from '@grabdy/common';
import { AiCallerType, AiRequestType, EMBEDDING_MODEL } from '@grabdy/contracts';
import { embedMany } from 'ai';

import { EMBEDDING_BATCH_SIZE } from '../../../config/constants';
import { DbService } from '../../../db/db.module';
import { AiUsageService } from '../../ai/ai-usage.service';
import type { ChunkWithMeta } from '../data-source.types';

@Injectable()
export class EmbeddingService {
  constructor(
    private db: DbService,
    private aiUsageService: AiUsageService
  ) {}

  /**
   * Embed chunks in batches and insert into the database.
   * Shared by all per-type processors.
   */
  async embedAndStore(
    chunks: ChunkWithMeta[],
    chunkIndexOffset: number,
    dataSourceId: DbId<'DataSource'>,
    collectionId: DbId<'Collection'> | null,
    orgId: DbId<'Org'>,
    progressBase: number
  ): Promise<void> {
    const totalBatches = Math.ceil(chunks.length / EMBEDDING_BATCH_SIZE);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const batchStart = batchIdx * EMBEDDING_BATCH_SIZE;
      const batch = chunks.slice(batchStart, batchStart + EMBEDDING_BATCH_SIZE);

      // Prepend embedding context to content for richer embeddings
      const textsToEmbed = batch.map((c) => {
        if (c.embeddingContext) {
          return `${c.embeddingContext}\n${c.content}`;
        }
        return c.content;
      });

      const result = await embedMany({
        model: openai.embedding('text-embedding-3-small'),
        values: textsToEmbed,
      });

      const values = batch.map((chunk, idx) => ({
        id: packId('Chunk', orgId),
        content: chunk.content,
        chunk_index: chunkIndexOffset + batchStart + idx,
        metadata: chunk.metadata,
        source_url: chunk.sourceUrl,
        source_key: chunk.sourceKey,
        embedding: `[${result.embeddings[idx].join(',')}]`,
        embedding_context: chunk.embeddingContext ?? null,
        extracted_image_id: chunk.extractedImageId ?? null,
        data_source_id: dataSourceId,
        collection_id: collectionId,
        org_id: orgId,
      }));

      await this.db.kysely.insertInto('data.chunks').values(values).execute();

      await this.aiUsageService.logUsage(
        EMBEDDING_MODEL,
        result.usage.tokens,
        0,
        AiCallerType.SYSTEM,
        AiRequestType.EMBEDDING,
        { orgId, source: 'SYSTEM' },
        { description: 'Embed chunks for data source' }
      );

      const batchProgress = progressBase + Math.round(((batchIdx + 1) / totalBatches) * 80);
      await this.setProgress(dataSourceId, orgId, batchProgress);
    }
  }

  /**
   * Update processing progress in the database (for the frontend/stale checker).
   */
  async setProgress(
    dataSourceId: DbId<'DataSource'>,
    orgId: DbId<'Org'>,
    progress: number
  ): Promise<void> {
    await this.db.kysely
      .updateTable('data.data_sources')
      .set({ processing_progress: progress, updated_at: new Date() })
      .where('id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .execute();
  }
}
