import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { type DbId, dbIdSchema, packId } from '@grabdy/common';
import type { DataSourceStatus, DataSourceType } from '@grabdy/contracts';
import { isUploadsMime, UPLOADS_MIME_TO_TYPE } from '@grabdy/contracts';
import type { Queue } from 'bullmq';

import { UserFacingError } from '../../common/errors/user-facing.error';
import { getMaxFileSizeForMime } from '../../config/constants';
import { DbService } from '../../db/db.module';
import { InjectTypedQueue } from '../../queue/queue.decorators';
import { NotificationService } from '../notification/notification.service';
import { StorageKeys } from '../storage/file-storage.interface';
import { S3FileStorage } from '../storage/s3-file-storage';

import { storageProxyUrl } from './data-source.types';
import { findDescendants } from './find-descendants';

@Injectable()
export class DataSourcesService {
  constructor(
    private db: DbService,
    private storage: S3FileStorage,
    private notification: NotificationService,
    @InjectTypedQueue('file-ingestion') private fileIngestionQueue: Queue,
    @InjectTypedQueue('data-source-cleanup') private cleanupQueue: Queue
  ) {}

  async upload(
    orgId: DbId<'Org'>,
    userId: DbId<'User'>,
    file: Express.Multer.File,
    options: { name?: string; collectionId?: DbId<'Collection'> }
  ) {
    if (!isUploadsMime(file.mimetype)) {
      throw new UserFacingError(`Unsupported file type: ${file.mimetype}`);
    }
    const mimeType = file.mimetype;
    const type = UPLOADS_MIME_TO_TYPE[mimeType];

    const maxSize = getMaxFileSizeForMime(file.mimetype);
    if (file.size > maxSize) {
      const limitMB = Math.round(maxSize / (1024 * 1024));
      throw new UserFacingError(`File too large. Maximum size for ${type} files is ${limitMB} MB`);
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

    await this.fileIngestionQueue.add('file', {
      orgId,
      dataSourceId: dataSource.id,
      storagePath: storageKey,
      mimeType,
      collectionId,
      filename: file.originalname,
    });

    return this.toResponse(dataSource);
  }

  async list(
    orgId: DbId<'Org'>,
    options?: { collectionId?: DbId<'Collection'>; type?: DataSourceType; hasCollection?: boolean }
  ) {
    let query = this.db.kysely
      .selectFrom('data.data_sources')
      .selectAll()
      .where('org_id', '=', orgId)
      .where('parent_data_source_id', 'is', null);

    if (options?.collectionId) {
      query = query.where('collection_id', '=', options.collectionId);
    }

    if (options?.type) {
      query = query.where('type', '=', options.type);
    }

    if (options?.hasCollection) {
      query = query.where('collection_id', 'is not', null);
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
      .select(['id', 'status', 'storage_path', 'parent_data_source_id'])
      .where('id', '=', id)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!dataSource) {
      throw new NotFoundException('Data source not found');
    }

    if (dataSource.parent_data_source_id) {
      throw new BadRequestException('Child data sources cannot be deleted directly');
    }

    if (dataSource.status !== 'READY' && dataSource.status !== 'FAILED') {
      throw new BadRequestException(
        'Data source can only be deleted when status is READY or FAILED'
      );
    }

    await this.db.kysely
      .updateTable('data.data_sources')
      .set({ status: 'DELETING', updated_at: new Date() })
      .where('id', '=', id)
      .where('org_id', '=', orgId)
      .execute();

    await this.cleanupQueue.add('cleanup', {
      orgId,
      dataSourceId: id,
      storagePath: dataSource.storage_path,
    });
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

  async getExtractedImageUrl(orgId: DbId<'Org'>, imageId: DbId<'ExtractedImage'>) {
    const image = await this.db.kysely
      .selectFrom('data.extracted_images')
      .select('storage_path')
      .where('id', '=', imageId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    return this.storage.getUrl(image.storage_path);
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

    if (dataSource.parent_data_source_id) {
      throw new UserFacingError('Cannot reprocess a child data source');
    }

    if (dataSource.status !== 'FAILED') {
      throw new UserFacingError('Only failed data sources can be reprocessed');
    }

    if (!isUploadsMime(dataSource.mime_type)) {
      throw new UserFacingError(`Unsupported file type: ${dataSource.mime_type}`);
    }

    // Collect all descendants (Email/PST create child data sources)
    const descendants = await findDescendants(this.db.kysely, orgId, id);

    // Clean up S3 files for children + extracted images for parent and children
    const s3Deletes: Promise<void>[] = [];
    s3Deletes.push(this.storage.deletePrefix(`${orgId}/extracted-images/${id}/`));
    for (const child of descendants) {
      if (child.storage_path) s3Deletes.push(this.storage.delete(child.storage_path));
      s3Deletes.push(this.storage.deletePrefix(`${orgId}/extracted-images/${child.id}/`));
    }
    const results = await Promise.allSettled(s3Deletes);
    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      this.notification.notifyS3CleanupFailure(id, failures.length);
    }

    // Delete chunks and children from DB, then reset parent status
    if (descendants.length > 0) {
      const ids = descendants.map((c) => c.id);
      await this.db.kysely
        .deleteFrom('data.chunks')
        .where('data_source_id', 'in', ids)
        .where('org_id', '=', orgId)
        .execute();
      await this.db.kysely
        .deleteFrom('data.data_sources')
        .where('id', 'in', ids)
        .where('org_id', '=', orgId)
        .execute();
    }

    await this.db.kysely
      .deleteFrom('data.chunks')
      .where('data_source_id', '=', id)
      .where('org_id', '=', orgId)
      .execute();

    await this.db.kysely
      .updateTable('data.data_sources')
      .set({ status: 'UPLOADED', updated_at: new Date() })
      .where('id', '=', id)
      .where('org_id', '=', orgId)
      .execute();

    await this.fileIngestionQueue.add('file', {
      orgId,
      dataSourceId: dataSource.id,
      storagePath: dataSource.storage_path,
      mimeType: dataSource.mime_type,
      collectionId: dataSource.collection_id,
      filename: dataSource.title,
    });

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
