import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleInit } from '@nestjs/common';

import { type DbId, dbIdSchema, extractOrgNumericId, packId } from '@grabdy/common';
import { isUploadsMime, UPLOADS_MIME_TO_TYPE } from '@grabdy/contracts';
import type { Job, Queue } from 'bullmq';

import { DbService } from '../../../db/db.module';
import { InjectTypedQueue } from '../../../queue/queue.decorators';
import { NotificationService } from '../../notification/notification.service';
import { S3FileStorage } from '../../storage/s3-file-storage';
import { chunkEmail } from '../services/chunking/chunk-content';
import type { EmailExtractionResult } from '../services/chunking/extractor.interface';
import { EmbeddingService } from '../services/embedding.service';
import { EnrichmentService, type ImageAnalysis } from '../services/enrichment.service';
import { PipelineService } from '../services/pipeline.service';
import { EmailExtractor } from '../sources/file/extractors/email.extractor';
import { MsgExtractor } from '../sources/file/extractors/msg.extractor';
import { PstExtractor } from '../sources/file/extractors/pst.extractor';
import { FileIngestionService } from '../sources/file/file-ingestion.service';

import type { ContractAnalysisJobData, FileIngestionJobData } from './job-data.types';

const EMAIL_MIMES = new Set(['message/rfc822', 'application/vnd.ms-outlook']);

/** MIME types eligible for AI contract metadata extraction. */
const CONTRACT_ELIGIBLE_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
]);

const PST_MIME = 'application/vnd.ms-outlook-pst';

const STALE_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
const STALE_THRESHOLD_MINUTES = 30;

@Processor('file-ingestion', { concurrency: 10 })
export class FileIngestionProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(FileIngestionProcessor.name);

  constructor(
    private fileIngestion: FileIngestionService,
    private enrichment: EnrichmentService,
    private pipelineService: PipelineService,
    private db: DbService,
    private storage: S3FileStorage,
    private embeddingService: EmbeddingService,
    private emailExtractor: EmailExtractor,
    private msgExtractor: MsgExtractor,
    private pstExtractor: PstExtractor,
    private notification: NotificationService,
    @InjectTypedQueue('file-ingestion') private fileIngestionQueue: Queue,
    @InjectTypedQueue('contract-analysis') private contractAnalysisQueue: Queue
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.fileIngestionQueue.add(
      'stale-check',
      {},
      {
        repeat: { every: STALE_CHECK_INTERVAL },
        jobId: 'stale-processing-check',
        removeOnComplete: true,
        removeOnFail: true,
      }
    );
    this.logger.log('Registered stale processing check (hourly)');
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'file':
        await this.processFile(job);
        break;
      case 'stale-check':
        await this.checkStaleProcessing();
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private isFinalAttempt(job: Job): boolean {
    const maxAttempts = job.opts.attempts ?? 1;
    return job.attemptsMade >= maxAttempts - 1;
  }

  private async checkStaleProcessing(): Promise<void> {
    // Get all active + waiting + delayed file jobs to check which data sources are still queued
    const [activeJobs, waitingJobs, delayedJobs] = await Promise.all([
      this.fileIngestionQueue.getJobs(['active']),
      this.fileIngestionQueue.getJobs(['waiting']),
      this.fileIngestionQueue.getJobs(['delayed']),
    ]);

    const queuedDataSourceIds = new Set<string>();
    for (const job of [...activeJobs, ...waitingJobs, ...delayedJobs]) {
      if (job.name === 'file' && job.data.dataSourceId) {
        queuedDataSourceIds.add(job.data.dataSourceId);
      }
    }

    // org-safe: system-level stale cleanup scans all orgs intentionally
    const staleRows = await this.db.kysely
      .selectFrom('data.data_sources')
      .select(['id', 'org_id', 'title'])
      .where('status', 'in', ['PROCESSING', 'UPLOADED'])
      .where('updated_at', '<', new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000))
      .execute();

    const orphaned = staleRows.filter((row) => !queuedDataSourceIds.has(row.id));
    if (orphaned.length === 0) return;

    this.logger.warn(`Found ${orphaned.length} stale PROCESSING data source(s), marking as FAILED`);

    // Group by org_id for tenant-scoped updates
    const byOrg = new Map<DbId<'Org'>, DbId<'DataSource'>[]>();
    for (const row of orphaned) {
      const ids = byOrg.get(row.org_id) ?? [];
      ids.push(row.id);
      byOrg.set(row.org_id, ids);
    }

    for (const [orgId, ids] of byOrg) {
      await this.db.kysely
        .updateTable('data.data_sources')
        .set({ status: 'FAILED', updated_at: new Date() })
        .where('id', 'in', ids)
        .where('org_id', '=', orgId)
        .where('status', 'in', ['PROCESSING', 'UPLOADED'])
        .execute();
    }

    const titles = orphaned.map((row) => `\`${row.id}\` (${row.title})`).join('\n');
    this.notification.notifyStaleProcessingCleanup(orphaned.length, titles);
  }

  private async processFile(job: Job<FileIngestionJobData>): Promise<void> {
    const data = job.data;
    const { orgId, dataSourceId, storagePath, mimeType, collectionId, filename } = data;
    const isAppendOnly = Boolean(data.appendOnly);

    await this.fileIngestion.updateDataSourceStatus({
      dataSourceId,
      orgId,
      status: 'PROCESSING',
      progress: 0,
    });

    try {
      if (mimeType === 'application/pdf') {
        await this.fileIngestion.extractAndChunkPdf({
          dataSourceId,
          orgId,
          storagePath,
          collectionId,
          appendOnly: isAppendOnly,
          filename,
        });

        await this.fileIngestion.updateDataSourceStatus({
          dataSourceId,
          orgId,
          status: 'READY',
          progress: 100,
        });
        await this.enqueueContractAnalysis({ orgId, dataSourceId }, mimeType);
        return;
      }

      if (EMAIL_MIMES.has(mimeType)) {
        await this.processEmail(job);
        return;
      }

      if (mimeType === PST_MIME) {
        await this.processPst(job);
        return;
      }

      const {
        chunks: rawChunks,
        pageCount,
        images,
      } = await this.fileIngestion.extractContent({
        dataSourceId,
        orgId,
        storagePath,
        mimeType,
        content: data.content,
        messages: data.messages,
        sourceUrl: data.sourceUrl,
      });

      await this.fileIngestion.updateDataSourceStatus({
        dataSourceId,
        orgId,
        status: 'PROCESSING',
        progress: 5,
      });

      // Process embedded images (e.g., DOCX): describe, store, weave into chunks
      if (images && images.length > 0) {
        const parsedDsId = dbIdSchema('DataSource').parse(dataSourceId);
        const parsedOrgId = dbIdSchema('Org').parse(orgId);

        const imageDescriptions = await this.enrichment.describeImages({
          orgId,
          dataSourceId: parsedDsId,
          storagePath,
          images: images.map((img) => ({
            buffer: img.buffer,
            page: img.page,
            surroundingText: img.surroundingText,
          })),
        });

        const imageIds = await this.pipelineService.storeExtractedImages({
          images: images.map((img, idx) => ({
            buffer: img.buffer,
            mimeType: img.mimeType,
            pageNumber: img.page,
            aiDescription: formatImageDescription(imageDescriptions[idx]?.analysis),
          })),
          dataSourceId: parsedDsId,
          orgId: parsedOrgId,
        });

        // Build page-to-descriptions map (multiple images per page) and link chunks to images
        const pageImageDescs = new Map<number, string[]>();
        const pageImageIdList = new Map<number, Array<(typeof imageIds)[number]>>();
        for (let i = 0; i < images.length; i++) {
          const page = images[i].page;
          const desc = formatImageDescription(imageDescriptions[i]?.analysis);
          if (desc) {
            const existing = pageImageDescs.get(page) ?? [];
            existing.push(desc);
            pageImageDescs.set(page, existing);
          }
          const existingIds = pageImageIdList.get(page) ?? [];
          existingIds.push(imageIds[i]);
          pageImageIdList.set(page, existingIds);
        }

        for (const chunk of rawChunks) {
          if (chunk.metadata.type === 'DOCX') {
            for (const page of chunk.metadata.pages) {
              const descs = pageImageDescs.get(page);
              if (descs) {
                for (const desc of descs) {
                  chunk.content += `\n[IMAGE: ${desc}]`;
                }
              }
              const ids = pageImageIdList.get(page);
              if (ids && ids.length > 0 && !chunk.extractedImageId) {
                chunk.extractedImageId = ids[0];
              }
            }
          }
        }

        // Create dedicated image chunks so each image is independently searchable
        const source = { sourceUrl: null, sourceKey: storagePath };
        for (let i = 0; i < images.length; i++) {
          const desc = formatImageDescription(imageDescriptions[i]?.analysis);
          if (!desc) continue;

          const page = images[i].page;
          const imgPageIds = pageImageIdList.get(page) ?? [];
          const imgIndex = images.filter((img) => img.page === page).indexOf(images[i]);
          const matchedImageId = imgPageIds[imgIndex];

          rawChunks.push({
            content: desc,
            metadata: { type: 'IMAGE' },
            sourceUrl: source.sourceUrl,
            sourceKey: source.sourceKey,
            extractedImageId: matchedImageId,
          });
        }
      }

      // For standalone image uploads, create an extracted_images record so search results include imageUrl
      if (mimeType.startsWith('image/') && rawChunks.length > 0 && !images) {
        const parsedDsId = dbIdSchema('DataSource').parse(dataSourceId);
        const parsedOrgId = dbIdSchema('Org').parse(orgId);
        const buffer = await this.storage.get(storagePath);

        const imageIds = await this.pipelineService.storeExtractedImages({
          images: [
            {
              buffer,
              mimeType,
              aiDescription: rawChunks[0].content.slice(0, 2000),
            },
          ],
          dataSourceId: parsedDsId,
          orgId: parsedOrgId,
        });

        if (imageIds.length > 0) {
          for (const chunk of rawChunks) {
            chunk.extractedImageId = imageIds[0];
          }
        }
      }

      const chunks = await this.enrichment.enrichChunks({
        orgId,
        chunks: rawChunks,
        title: filename ?? '',
      });

      await this.fileIngestion.updateDataSourceStatus({
        dataSourceId,
        orgId,
        status: 'PROCESSING',
        progress: 15,
      });

      let chunkIndexOffset = 0;
      if (!isAppendOnly) {
        await this.fileIngestion.deleteChunks({ dataSourceId, orgId });
      } else {
        chunkIndexOffset = await this.fileIngestion.getChunkOffset({ dataSourceId, orgId });
      }

      await this.fileIngestion.embedAndStore({
        chunks,
        chunkIndexOffset,
        dataSourceId,
        collectionId,
        orgId,
        progressBase: 20,
      });

      const totalChunks = isAppendOnly ? chunkIndexOffset + chunks.length : chunks.length;
      await this.fileIngestion.updateDataSourceStatus({
        dataSourceId,
        orgId,
        status: 'READY',
        pageCount: pageCount ?? totalChunks,
        progress: 100,
      });
      await this.enqueueContractAnalysis({ orgId, dataSourceId }, mimeType);
    } catch (error) {
      if (this.isFinalAttempt(job)) {
        await this.fileIngestion.updateDataSourceStatus({
          dataSourceId,
          orgId,
          status: 'FAILED',
        });
      }
      throw error;
    }
  }

  private async processEmail(job: Job<FileIngestionJobData>): Promise<void> {
    const data = job.data;
    const { orgId, dataSourceId, storagePath, mimeType, collectionId, filename } = data;

    try {
      const parsedDataSourceId = dbIdSchema('DataSource').parse(dataSourceId);
      const parsedOrgId = dbIdSchema('Org').parse(orgId);
      const parsedCollectionId = collectionId ? dbIdSchema('Collection').parse(collectionId) : null;

      const buffer = await this.storage.get(storagePath);

      const emailResult =
        mimeType === 'application/vnd.ms-outlook'
          ? this.msgExtractor.extract(buffer)
          : await this.emailExtractor.extract(buffer);

      const source = { sourceUrl: null, sourceKey: storagePath };
      const chunks = chunkEmail(emailResult, source);
      const title = emailResult.headers.subject || filename || 'Email';

      await this.fileIngestion.updateDataSourceStatus({
        dataSourceId,
        orgId,
        status: 'PROCESSING',
        progress: 5,
      });

      const enrichedChunks = await this.enrichment.enrichChunks({
        orgId,
        chunks,
        title,
      });

      await this.fileIngestion.updateDataSourceStatus({
        dataSourceId,
        orgId,
        status: 'PROCESSING',
        progress: 15,
      });

      await this.embeddingService.embedAndStore(
        enrichedChunks,
        0,
        parsedDataSourceId,
        parsedCollectionId,
        parsedOrgId,
        20
      );

      // Upload attachments to S3, create child DataSource records, enqueue child jobs
      const orgNum = extractOrgNumericId(parsedOrgId);
      const childJobs: Array<{
        name: string;
        data: FileIngestionJobData;
      }> = [];

      for (const att of emailResult.attachments) {
        if (
          att.mimeType === 'message/rfc822' ||
          att.mimeType === 'application/vnd.ms-outlook' ||
          att.mimeType === 'application/vnd.ms-outlook-pst'
        )
          continue;

        if (!isUploadsMime(att.mimeType)) continue;

        const childDsId = packId('DataSource', orgNum);
        const childStoragePath = `uploads/${parsedOrgId}/${childDsId}/${att.filename}`;

        await this.storage.put(childStoragePath, att.buffer, att.mimeType);

        const dsType = UPLOADS_MIME_TO_TYPE[att.mimeType];

        await this.db.kysely
          .insertInto('data.data_sources')
          .values({
            id: childDsId,
            title: att.filename,
            mime_type: att.mimeType,
            file_size: att.size,
            storage_path: childStoragePath,
            type: dsType,
            page_count: null,
            collection_id: parsedCollectionId,
            source_url: '',
            parent_data_source_id: parsedDataSourceId,
            classification: null,
            uploaded_by_id: null,
            org_id: parsedOrgId,
            updated_at: new Date(),
          })
          .execute();

        childJobs.push({
          name: 'file',
          data: {
            orgId,
            dataSourceId: childDsId,
            storagePath: childStoragePath,
            mimeType: att.mimeType,
            collectionId,
            filename: att.filename,
          },
        });
      }

      if (childJobs.length > 0) {
        await this.fileIngestionQueue.addBulk(childJobs);
      }

      await this.fileIngestion.updateDataSourceStatus({
        dataSourceId,
        orgId,
        status: 'READY',
        pageCount: enrichedChunks.length,
        progress: 100,
      });
      await this.enqueueContractAnalysis({ orgId, dataSourceId }, mimeType);
    } catch (error) {
      if (this.isFinalAttempt(job)) {
        await this.fileIngestion.updateDataSourceStatus({
          dataSourceId,
          orgId,
          status: 'FAILED',
        });
      }
      throw error;
    }
  }

  private async processPst(job: Job<FileIngestionJobData>): Promise<void> {
    const data = job.data;
    const { orgId, dataSourceId, storagePath, collectionId } = data;

    try {
      const parsedDataSourceId = dbIdSchema('DataSource').parse(dataSourceId);
      const parsedOrgId = dbIdSchema('Org').parse(orgId);
      const parsedCollectionId = collectionId ? dbIdSchema('Collection').parse(collectionId) : null;

      // Use temp file to avoid loading entire PST into memory
      const tempFile = await this.storage.getTempPath(storagePath);
      let emails: EmailExtractionResult[];
      try {
        emails = this.pstExtractor.extract(tempFile.path);
      } finally {
        await tempFile.cleanup();
      }

      await this.fileIngestion.updateDataSourceStatus({
        dataSourceId,
        orgId,
        status: 'PROCESSING',
        progress: 10,
      });

      const orgNum = extractOrgNumericId(parsedOrgId);
      const childJobs: Array<{
        name: string;
        data: FileIngestionJobData;
      }> = [];

      for (let emailIdx = 0; emailIdx < emails.length; emailIdx++) {
        const email = emails[emailIdx];
        const subject = email.headers.subject || 'Untitled email';
        const emailDsId = packId('DataSource', orgNum);
        const safeSubject = subject.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 80);
        const emailStoragePath = `uploads/${parsedOrgId}/${emailDsId}/${safeSubject}.eml`;

        // Build text-only .eml (attachments handled separately below)
        const emlContent = buildEmlFromExtraction(email);
        await this.storage.put(emailStoragePath, emlContent, 'message/rfc822');

        await this.db.kysely
          .insertInto('data.data_sources')
          .values({
            id: emailDsId,
            title: subject,
            mime_type: 'message/rfc822',
            file_size: emlContent.length,
            storage_path: emailStoragePath,
            type: 'EMAIL',
            page_count: null,
            collection_id: parsedCollectionId,
            source_url: '',
            parent_data_source_id: parsedDataSourceId,
            classification: null,
            uploaded_by_id: null,
            org_id: parsedOrgId,
            updated_at: new Date(),
          })
          .execute();

        childJobs.push({
          name: 'file',
          data: {
            orgId,
            dataSourceId: emailDsId,
            storagePath: emailStoragePath,
            mimeType: 'message/rfc822',
            collectionId,
            filename: `${safeSubject}.eml`,
          },
        });

        // Upload each attachment as a child DataSource of the email DS
        for (const att of email.attachments) {
          if (
            att.mimeType === 'message/rfc822' ||
            att.mimeType === 'application/vnd.ms-outlook' ||
            att.mimeType === 'application/vnd.ms-outlook-pst'
          )
            continue;

          if (!isUploadsMime(att.mimeType)) continue;

          const attDsId = packId('DataSource', orgNum);
          const attStoragePath = `uploads/${parsedOrgId}/${attDsId}/${att.filename}`;

          await this.storage.put(attStoragePath, att.buffer, att.mimeType);

          const dsType = UPLOADS_MIME_TO_TYPE[att.mimeType];

          await this.db.kysely
            .insertInto('data.data_sources')
            .values({
              id: attDsId,
              title: att.filename,
              mime_type: att.mimeType,
              file_size: att.size,
              storage_path: attStoragePath,
              type: dsType,
              page_count: null,
              collection_id: parsedCollectionId,
              source_url: '',
              parent_data_source_id: emailDsId,
              classification: null,
              uploaded_by_id: null,
              org_id: parsedOrgId,
              updated_at: new Date(),
            })
            .execute();

          childJobs.push({
            name: 'file',
            data: {
              orgId,
              dataSourceId: attDsId,
              storagePath: attStoragePath,
              mimeType: att.mimeType,
              collectionId,
              filename: att.filename,
            },
          });
        }

        // Update progress based on emails processed (10-90% range)
        const emailProgress = 10 + Math.round(((emailIdx + 1) / emails.length) * 80);
        await this.fileIngestion.updateDataSourceStatus({
          dataSourceId,
          orgId,
          status: 'PROCESSING',
          progress: emailProgress,
        });
      }

      if (childJobs.length > 0) {
        await this.fileIngestionQueue.addBulk(childJobs);
      }

      await this.fileIngestion.updateDataSourceStatus({
        dataSourceId,
        orgId,
        status: 'READY',
        pageCount: emails.length,
        progress: 100,
      });
    } catch (error) {
      if (this.isFinalAttempt(job)) {
        await this.fileIngestion.updateDataSourceStatus({
          dataSourceId,
          orgId,
          status: 'FAILED',
        });
      }
      throw error;
    }
  }

  private async enqueueContractAnalysis(
    data: ContractAnalysisJobData,
    mimeType: string
  ): Promise<void> {
    if (!CONTRACT_ELIGIBLE_MIMES.has(mimeType)) return;
    await this.contractAnalysisQueue.add('analyze', data, {
      attempts: 4,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}(${job.id}) failed: ${err.message}`);
  }
}

/**
 * Build a minimal RFC 2822 email from extracted email data.
 * Used to store individual PST emails as .eml files.
 */
function buildEmlFromExtraction(email: EmailExtractionResult): Buffer {
  const lines: string[] = [];
  if (email.headers.from) lines.push(`From: ${email.headers.from}`);
  if (email.headers.to.length > 0) lines.push(`To: ${email.headers.to.join(', ')}`);
  if (email.headers.subject) lines.push(`Subject: ${email.headers.subject}`);
  if (email.headers.date) {
    // Convert ISO 8601 to RFC 2822 if needed
    const dateStr = email.headers.date;
    const parsed = new Date(dateStr);
    lines.push(`Date: ${isNaN(parsed.getTime()) ? dateStr : parsed.toUTCString()}`);
  }
  if (email.headers.rfcMessageRef) lines.push(`Message-ID: ${email.headers.rfcMessageRef}`);
  lines.push('MIME-Version: 1.0');
  lines.push('Content-Type: text/plain; charset=utf-8');
  lines.push('');
  lines.push(email.bodyText);
  return Buffer.from(lines.join('\r\n'), 'utf-8');
}

function formatImageDescription(analysis: ImageAnalysis | undefined): string {
  if (!analysis || !analysis.description.trim()) return '';

  const parts = [`[${analysis.type}] ${analysis.description}`];
  if (analysis.visibleText) parts.push(`Text: ${analysis.visibleText}`);
  if (analysis.dataValues) parts.push(`Data: ${analysis.dataValues}`);
  if (analysis.relationships) parts.push(`Relationships: ${analysis.relationships}`);
  return parts.join(' ');
}
