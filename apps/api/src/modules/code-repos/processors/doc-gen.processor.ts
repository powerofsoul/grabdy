import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { dbIdSchema } from '@grabdy/common';
import type { DbId } from '@grabdy/common';
import { Job } from 'bullmq';
import { z } from 'zod';

import { DbService } from '../../../db/db.module';
import { CODE_REPO_DOC_GEN_QUEUE } from '../../queue/queue.constants';

import { DocEmbeddingService } from '../services/doc-embedding.service';

const reEmbedDocPageJobSchema = z.object({
  orgId: dbIdSchema('Org'),
  dataSourceId: dbIdSchema('DataSource'),
  pageId: dbIdSchema('DocPage'),
});

type ReEmbedDocPageJobData = z.infer<typeof reEmbedDocPageJobSchema>;

@Processor(CODE_REPO_DOC_GEN_QUEUE, { concurrency: 2 })
export class DocGenProcessor extends WorkerHost {
  private readonly logger = new Logger(DocGenProcessor.name);

  constructor(
    private db: DbService,
    private docEmbeddingService: DocEmbeddingService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 're-embed-doc-page': {
        const parsed = reEmbedDocPageJobSchema.safeParse(job.data);
        if (!parsed.success) {
          this.logger.error(`Invalid re-embed-doc-page job data: ${parsed.error.message}`);
          return;
        }
        await this.handleReEmbed(parsed.data);
        return;
      }
      case 'regenerate-page':
      case 'regenerate-all':
        this.logger.error(
          `Job "${job.name}" is not yet implemented. ` +
            `Doc page regeneration requires the code-indexer infrastructure.`
        );
        return;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Job ${job.name} (${job.id}) failed: ${error.message}`);
  }

  private async handleReEmbed(data: ReEmbedDocPageJobData): Promise<void> {
    const { orgId, dataSourceId, pageId } = data;

    const page = await this.db.kysely
      .selectFrom('data.code_repo_doc_pages')
      .select(['title', 'content'])
      .where('id', '=', pageId)
      .where('data_source_id', '=', dataSourceId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!page) {
      this.logger.warn(`Doc page ${pageId} not found, skipping re-embed`);
      return;
    }

    const repoState = await this.db.kysely
      .selectFrom('data.code_repo_state')
      .select(['repo_full_name'])
      .where('data_source_id', '=', dataSourceId)
      .executeTakeFirst();

    if (!repoState) {
      this.logger.warn(`No repo state for data source ${dataSourceId}, skipping re-embed`);
      return;
    }

    await this.docEmbeddingService.reEmbedDocPage(
      pageId,
      page.title,
      page.content,
      dataSourceId,
      orgId,
      repoState.repo_full_name,
    );
  }
}
