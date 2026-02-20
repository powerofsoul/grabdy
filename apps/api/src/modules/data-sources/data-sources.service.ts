import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { type DbId, extractOrgNumericId, packId } from '@grabdy/common';
import type { DataSourceStatus, DataSourceType } from '@grabdy/contracts';
import { isUploadsMime, UPLOADS_MIME_TO_TYPE } from '@grabdy/contracts';
import { Queue } from 'bullmq';

import { getMaxFileSizeForMime } from '../../config/constants';
import { env } from '../../config/env.config';
import { DbService } from '../../db/db.module';
import { DATA_SOURCE_QUEUE } from '../queue/queue.constants';
import type { FileStorage } from '../storage/file-storage.interface';
import { FILE_STORAGE } from '../storage/file-storage.interface';

import type { DataSourceJobData } from './data-source.processor';

@Injectable()
export class DataSourcesService {
  constructor(
    private db: DbService,
    @InjectQueue(DATA_SOURCE_QUEUE) private dataSourceQueue: Queue,
    @Inject(FILE_STORAGE) private storage: FileStorage
  ) {}

  async upload(
    orgId: DbId<'Org'>,
    userId: DbId<'User'>,
    file: Express.Multer.File,
    options: { name?: string; collectionId?: DbId<'Collection'> }
  ) {
    if (!isUploadsMime(file.mimetype)) {
      throw new Error(`Unsupported file type: ${file.mimetype}`);
    }
    const mimeType = file.mimetype;
    const type = UPLOADS_MIME_TO_TYPE[mimeType];

    const maxSize = getMaxFileSizeForMime(file.mimetype);
    if (file.size > maxSize) {
      const limitMB = Math.round(maxSize / (1024 * 1024));
      throw new Error(`File too large. Maximum size for ${type} files is ${limitMB} MB`);
    }

    // Storage key: {orgNumericId}/{timestamp}-{originalname}
    const orgNum = extractOrgNumericId(orgId).toString();
    const filename = `${Date.now()}-${file.originalname}`;
    const storageKey = `${orgNum}/${filename}`;

    await this.storage.put(storageKey, file.buffer, file.mimetype);

    const collectionId = options.collectionId ?? null;
    const dataSourceId = packId('DataSource', orgId);

    const dataSource = await this.db.kysely
      .insertInto('data.data_sources')
      .values({
        id: dataSourceId,
        title: options.name ?? file.originalname,
        mime_type: file.mimetype,
        file_size: file.size,
        storage_path: storageKey,
        type,
        source_url: `${env.frontendUrl}/dashboard/sources?preview=${dataSourceId}&org=${orgId}`,
        collection_id: collectionId,
        org_id: orgId,
        uploaded_by_id: userId,
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Queue processing job
    const jobData: DataSourceJobData = {
      dataSourceId: dataSource.id,
      orgId,
      storagePath: storageKey,
      mimeType,
      collectionId,
    };

    await this.dataSourceQueue.add('process', jobData);

    return this.toResponse(dataSource);
  }

  async list(orgId: DbId<'Org'>, collectionId?: DbId<'Collection'>) {
    let query = this.db.kysely
      .selectFrom('data.data_sources')
      .selectAll()
      .where('org_id', '=', orgId);

    if (collectionId) {
      query = query.where('collection_id', '=', collectionId);
    }

    const dataSources = await query.orderBy('created_at', 'desc').execute();
    return dataSources.map(this.toResponse);
  }

  async findById(orgId: DbId<'Org'>, id: DbId<'DataSource'>) {
    const dataSource = await this.db.kysely
      .selectFrom('data.data_sources')
      .selectAll()
      .where('id', '=', id)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!dataSource) {
      throw new NotFoundException('Data source not found');
    }

    return this.toResponse(dataSource);
  }

  async delete(orgId: DbId<'Org'>, id: DbId<'DataSource'>) {
    const dataSource = await this.db.kysely
      .selectFrom('data.data_sources')
      .select(['id', 'storage_path'])
      .where('id', '=', id)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!dataSource) {
      throw new NotFoundException('Data source not found');
    }

    // Delete extracted images from storage
    const extractedImages = await this.db.kysely
      .selectFrom('data.extracted_images')
      .select('storage_path')
      .where('data_source_id', '=', id)
      .where('org_id', '=', orgId)
      .execute();

    for (const img of extractedImages) {
      await this.storage.delete(img.storage_path);
    }

    // Delete chunks first
    await this.db.kysely
      .deleteFrom('data.chunks')
      .where('data_source_id', '=', id)
      .where('org_id', '=', orgId)
      .execute();

    // Delete the record (extracted_images cascade via FK)
    await this.db.kysely
      .deleteFrom('data.data_sources')
      .where('id', '=', id)
      .where('org_id', '=', orgId)
      .execute();

    // Delete file from storage
    await this.storage.delete(dataSource.storage_path);
  }

  async rename(orgId: DbId<'Org'>, id: DbId<'DataSource'>, title: string) {
    const dataSource = await this.db.kysely
      .updateTable('data.data_sources')
      .set({ title, updated_at: new Date() })
      .where('id', '=', id)
      .where('org_id', '=', orgId)
      .returningAll()
      .executeTakeFirst();

    if (!dataSource) {
      throw new NotFoundException('Data source not found');
    }

    return this.toResponse(dataSource);
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    return this.storage.get(key);
  }

  async getPreviewUrl(orgId: DbId<'Org'>, id: DbId<'DataSource'>) {
    const dataSource = await this.db.kysely
      .selectFrom('data.data_sources')
      .select(['storage_path', 'mime_type', 'title'])
      .where('id', '=', id)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!dataSource) {
      throw new NotFoundException('Data source not found');
    }

    const url = await this.storage.getUrl(dataSource.storage_path);

    return {
      url,
      mimeType: dataSource.mime_type,
      title: dataSource.title,
    };
  }

  async listExtractedImages(orgId: DbId<'Org'>, id: DbId<'DataSource'>) {
    // Verify data source exists and belongs to org
    const dataSource = await this.db.kysely
      .selectFrom('data.data_sources')
      .select('id')
      .where('id', '=', id)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!dataSource) {
      throw new NotFoundException('Data source not found');
    }

    const images = await this.db.kysely
      .selectFrom('data.extracted_images')
      .select(['id', 'storage_path', 'mime_type', 'page_number', 'ai_description'])
      .where('data_source_id', '=', id)
      .where('org_id', '=', orgId)
      .orderBy('page_number', 'asc')
      .execute();

    const results = await Promise.all(
      images.map(async (img) => ({
        id: img.id,
        mimeType: img.mime_type,
        pageNumber: img.page_number,
        url: await this.storage.getUrl(img.storage_path),
        aiDescription: img.ai_description,
      }))
    );

    return results;
  }

  async reprocess(orgId: DbId<'Org'>, id: DbId<'DataSource'>) {
    const dataSource = await this.db.kysely
      .selectFrom('data.data_sources')
      .selectAll()
      .where('id', '=', id)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!dataSource) {
      throw new NotFoundException('Data source not found');
    }

    // Delete existing chunks
    await this.db.kysely
      .deleteFrom('data.chunks')
      .where('data_source_id', '=', id)
      .where('org_id', '=', orgId)
      .execute();

    // Delete extracted images from storage and DB
    const extractedImages = await this.db.kysely
      .selectFrom('data.extracted_images')
      .select('storage_path')
      .where('data_source_id', '=', id)
      .where('org_id', '=', orgId)
      .execute();

    for (const img of extractedImages) {
      await this.storage.delete(img.storage_path);
    }

    await this.db.kysely
      .deleteFrom('data.extracted_images')
      .where('data_source_id', '=', id)
      .where('org_id', '=', orgId)
      .execute();

    // Reset status
    await this.db.kysely
      .updateTable('data.data_sources')
      .set({ status: 'UPLOADED', updated_at: new Date() })
      .where('id', '=', id)
      .where('org_id', '=', orgId)
      .execute();

    // Re-queue
    if (!isUploadsMime(dataSource.mime_type)) {
      throw new Error(`Unsupported mime type in database: ${dataSource.mime_type}`);
    }
    const jobData: DataSourceJobData = {
      dataSourceId: dataSource.id,
      orgId,
      storagePath: dataSource.storage_path,
      mimeType: dataSource.mime_type,
      collectionId: dataSource.collection_id,
    };

    await this.dataSourceQueue.add('process', jobData);

    return this.toResponse({ ...dataSource, status: 'UPLOADED' as const });
  }

  private toResponse(ds: {
    id: DbId<'DataSource'>;
    title: string;
    mime_type: string;
    file_size: number;
    type: DataSourceType;
    status: DataSourceStatus;
    summary: string | null;
    page_count: number | null;
    collection_id: DbId<'Collection'> | null;
    org_id: DbId<'Org'>;
    uploaded_by_id: DbId<'User'> | null;
    created_at: Date;
    updated_at: Date;
  }) {
    return {
      id: ds.id,
      title: ds.title,
      mimeType: ds.mime_type,
      fileSize: ds.file_size,
      type: ds.type,
      status: ds.status,
      summary: ds.summary,
      pageCount: ds.page_count,
      collectionId: ds.collection_id,
      orgId: ds.org_id,
      uploadedById: ds.uploaded_by_id,
      createdAt: ds.created_at,
      updatedAt: ds.updated_at,
    };
  }
}
