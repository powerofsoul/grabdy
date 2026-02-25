import { Injectable, NotFoundException } from '@nestjs/common';

import { type DbId, packId } from '@grabdy/common';
import type { DataSourceStatus, DataSourceType } from '@grabdy/contracts';
import { isUploadsMime, UPLOADS_MIME_TO_TYPE } from '@grabdy/contracts';

import { getMaxFileSizeForMime } from '../../config/constants';
import { DbService } from '../../db/db.module';
import { StorageKeys } from '../storage/file-storage.interface';
import { S3FileStorage } from '../storage/s3-file-storage';

import type { DataSourceJobData } from './data-source.types';
import { storageProxyUrl } from './data-source.types';
import { DataSourceDispatchService } from './data-source-dispatch.service';

@Injectable()
export class DataSourcesService {
  constructor(
    private db: DbService,
    private storage: S3FileStorage,
    private dispatch: DataSourceDispatchService
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

    const collectionId = options.collectionId ?? null;
    const dataSourceId = packId('DataSource', orgId);

    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? 'bin';
    const storageKey = StorageKeys.fileDataSource(orgId, collectionId, dataSourceId, ext);

    await this.storage.put(storageKey, file.buffer, file.mimetype);

    const dataSource = await this.db.kysely
      .insertInto('data.data_sources')
      .values({
        id: dataSourceId,
        title: options.name ?? file.originalname,
        mime_type: file.mimetype,
        file_size: file.size,
        storage_path: storageKey,
        type,
        source_url: storageProxyUrl(orgId, storageKey),
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

    await this.dispatch.dispatch(jobData);

    return this.toResponse(dataSource);
  }

  async list(orgId: DbId<'Org'>, collectionId?: DbId<'Collection'>, type?: DataSourceType) {
    let query = this.db.kysely
      .selectFrom('data.data_sources')
      .selectAll()
      .where('org_id', '=', orgId);

    if (collectionId) {
      query = query.where('collection_id', '=', collectionId);
    }

    if (type) {
      query = query.where('type', '=', type);
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

    await this.db.kysely
      .deleteFrom('data.chunks')
      .where('data_source_id', '=', id)
      .where('org_id', '=', orgId)
      .execute();

    await this.db.kysely
      .deleteFrom('data.data_sources')
      .where('id', '=', id)
      .where('org_id', '=', orgId)
      .execute();

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

    await this.dispatch.dispatch(jobData);

    return this.toResponse({ ...dataSource, status: 'UPLOADED' });
  }

  private toResponse(ds: {
    id: DbId<'DataSource'>;
    title: string;
    mime_type: string;
    file_size: number;
    type: DataSourceType;
    status: DataSourceStatus;
    processing_progress: number | null;
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
      processingProgress: ds.processing_progress,
      pageCount: ds.page_count,
      collectionId: ds.collection_id,
      orgId: ds.org_id,
      uploadedById: ds.uploaded_by_id,
      createdAt: ds.created_at,
      updatedAt: ds.updated_at,
    };
  }
}
