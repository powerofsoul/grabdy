import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { dbIdSchema, extractOrgNumericId, packId } from '@grabdy/common';
import { isUploadsMime, UPLOADS_MIME_TO_TYPE } from '@grabdy/contracts';
import type { Job, Queue } from 'bullmq';

import { DbService } from '../../../db/db.module';
import { InjectTypedQueue } from '../../../queue/queue.decorators';
import { S3FileStorage } from '../../storage/s3-file-storage';
import { chunkEmail } from '../services/chunking/chunk-content';
import type { EmailExtractionResult } from '../services/chunking/extractor.interface';
import { EmbeddingService } from '../services/embedding.service';
import { EnrichmentService } from '../services/enrichment.service';
import { PipelineService } from '../services/pipeline.service';
import { EmailExtractor } from '../sources/file/extractors/email.extractor';
import { MsgExtractor } from '../sources/file/extractors/msg.extractor';
import { PstExtractor } from '../sources/file/extractors/pst.extractor';
import { FileIngestionService } from '../sources/file/file-ingestion.service';

import type { FileIngestionJobData } from './job-data.types';

const EMAIL_MIMES = new Set(['message/rfc822', 'application/vnd.ms-outlook']);

const PST_MIME = 'application/vnd.ms-outlook-pst';

@Processor('file-ingestion', { concurrency: 10 })
export class FileIngestionProcessor extends WorkerHost {
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
    @InjectTypedQueue('file-ingestion') private fileIngestionQueue: Queue
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case 'file':
        await this.processFile(job.data);
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async processFile(data: FileIngestionJobData): Promise<void> {
    const { orgId, dataSourceId, storagePath, mimeType, collectionId, filename } = data;
    const isAppendOnly = Boolean(data.appendOnly);

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
        return;
      }

      if (EMAIL_MIMES.has(mimeType)) {
        await this.processEmail(data);
        return;
      }

      if (mimeType === PST_MIME) {
        await this.processPst(data);
        return;
      }

      if (!isAppendOnly) {
        await this.fileIngestion.updateDataSourceStatus({
          dataSourceId,
          orgId,
          status: 'PROCESSING',
          progress: 0,
        });
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

      // Process embedded images (e.g., DOCX): describe, store, weave into chunks
      if (images && images.length > 0) {
        const parsedDsId = dbIdSchema('DataSource').parse(dataSourceId);
        const parsedOrgId = dbIdSchema('Org').parse(orgId);

        const imageDescriptions = await this.enrichment.describeImages({
          orgId,
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
            aiDescription: imageDescriptions[idx]?.description,
          })),
          dataSourceId: parsedDsId,
          orgId: parsedOrgId,
        });

        // Build page-to-descriptions map (multiple images per page) and link chunks to images
        const pageImageDescs = new Map<number, string[]>();
        const pageImageIdList = new Map<number, Array<(typeof imageIds)[number]>>();
        for (let i = 0; i < images.length; i++) {
          const page = images[i].page;
          const desc = imageDescriptions[i]?.description ?? '';
          if (desc.trim()) {
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
      }

      const chunks = await this.enrichment.enrichChunks({
        orgId,
        chunks: rawChunks,
        title: filename ?? '',
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
        progressBase: 15,
      });

      const totalChunks = isAppendOnly ? chunkIndexOffset + chunks.length : chunks.length;
      await this.fileIngestion.updateDataSourceStatus({
        dataSourceId,
        orgId,
        status: 'READY',
        pageCount: pageCount ?? totalChunks,
        progress: 100,
      });
    } catch (error) {
      await this.fileIngestion.updateDataSourceStatus({
        dataSourceId,
        orgId,
        status: 'FAILED',
      });
      throw error;
    }
  }

  private async processEmail(data: FileIngestionJobData): Promise<void> {
    const { orgId, dataSourceId, storagePath, mimeType, collectionId, filename } = data;

    try {
      await this.fileIngestion.updateDataSourceStatus({
        dataSourceId,
        orgId,
        status: 'PROCESSING',
        progress: 0,
      });

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

      const enrichedChunks = await this.enrichment.enrichChunks({
        orgId,
        chunks,
        title,
      });

      await this.embeddingService.embedAndStore(
        enrichedChunks,
        0,
        parsedDataSourceId,
        parsedCollectionId,
        parsedOrgId,
        10
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
            connection_id: null,
            external_id: null,
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
    } catch (error) {
      await this.fileIngestion.updateDataSourceStatus({
        dataSourceId,
        orgId,
        status: 'FAILED',
      });
      throw error;
    }
  }

  private async processPst(data: FileIngestionJobData): Promise<void> {
    const { orgId, dataSourceId, storagePath, collectionId } = data;

    try {
      await this.fileIngestion.updateDataSourceStatus({
        dataSourceId,
        orgId,
        status: 'PROCESSING',
        progress: 0,
      });

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

      const orgNum = extractOrgNumericId(parsedOrgId);
      const childJobs: Array<{
        name: string;
        data: FileIngestionJobData;
      }> = [];

      for (const email of emails) {
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
            connection_id: null,
            external_id: null,
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
              connection_id: null,
              external_id: null,
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
      await this.fileIngestion.updateDataSourceStatus({
        dataSourceId,
        orgId,
        status: 'FAILED',
      });
      throw error;
    }
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
