import { Injectable, Logger } from '@nestjs/common';

import { openai } from '@ai-sdk/openai';
import { type DbId, packId } from '@grabdy/common';
import { type ChunkMeta, DOC_PAGE_FILE_PATH } from '@grabdy/contracts';
import { sql } from 'kysely';

import { EMBEDDING_BATCH_SIZE } from '../../../config/constants';
import { DbService } from '../../../db/db.module';
import { AiService } from '../../ai/ai.service';
import { chunkPlainText } from '../../data-sources/chunking/chunk-content';

@Injectable()
export class DocEmbeddingService {
  private readonly logger = new Logger(DocEmbeddingService.name);

  constructor(
    private db: DbService,
    private aiService: AiService
  ) {}

  async reEmbedDocPage(
    pageId: DbId<'DocPage'>,
    pageTitle: string,
    content: string,
    dataSourceId: DbId<'DataSource'>,
    orgId: DbId<'Org'>,
    repoFullName: string
  ): Promise<void> {
    // Delete old doc chunks for this page using jsonb metadata query
    await this.db.kysely
      .deleteFrom('data.chunks')
      .where('data_source_id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .where(sql`metadata->>'docPageId'`, '=', pageId)
      .execute();

    const metadata: ChunkMeta = {
      type: 'CODE_REPO',
      filePath: DOC_PAGE_FILE_PATH,
      language: 'Markdown',
      repoFullName,
      startLine: 0,
      endLine: 0,
      fileSummary: pageTitle,
      docPageId: pageId,
      docPageTitle: pageTitle,
    };

    const chunks = chunkPlainText(content, metadata, '');

    if (chunks.length === 0) {
      return;
    }

    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);

      const { embeddings } = await this.aiService.embedMany(
        { model: openai.embedding('text-embedding-3-small'), values: batch.map((c) => c.content) },
        { orgId, source: 'SYSTEM' }
      );

      const values = batch.map((chunk, idx) => ({
        id: packId('Chunk', orgId),
        content: chunk.content,
        chunk_index: i + idx,
        metadata: chunk.metadata,
        source_url: chunk.sourceUrl,
        embedding: `[${embeddings[idx].join(',')}]`,
        data_source_id: dataSourceId,
        collection_id: null,
        org_id: orgId,
      }));

      await this.db.kysely.insertInto('data.chunks').values(values).execute();
    }

    this.logger.log(
      `Re-embedded doc page "${pageTitle}" (${chunks.length} chunks) for ${repoFullName}`
    );
  }
}
