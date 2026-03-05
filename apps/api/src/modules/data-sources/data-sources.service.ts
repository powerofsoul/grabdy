import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { type DbId, packId } from '@grabdy/common';
import type { DataSourceStatus, DataSourceType } from '@grabdy/contracts';
import { isUploadsMime, UPLOADS_MIME_TO_TYPE } from '@grabdy/contracts';
import type { Queue } from 'bullmq';

import { UserFacingError } from '../../common/errors/user-facing.error';
import { getMaxFileSizeForMime } from '../../config/constants';
import { DbService } from '../../db/db.module';
import { InjectTypedQueue } from '../../queue/queue.decorators';
import { ProxyService } from '../proxy/proxy.service';
import { StorageKeys } from '../storage/file-storage.interface';
import { S3FileStorage } from '../storage/s3-file-storage';

@Injectable()
export class DataSourcesService {
  constructor(
    private db: DbService,
    private storage: S3FileStorage,
    private proxyService: ProxyService,
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
        source_url: this.proxyService.storageProxyUrl(orgId, storageKey),
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
    options?: {
      collectionId?: DbId<'Collection'>;
      type?: DataSourceType;
      hasCollection?: boolean;
      rootOnly?: boolean;
      search?: string;
    }
  ) {
    let query = this.db.kysely
      .selectFrom('data.data_sources')
      .leftJoin('data.contracts', 'data.contracts.data_source_id', 'data.data_sources.id')
      .selectAll('data.data_sources')
      .select('data.contracts.id as contract_id')
      .where('data.data_sources.org_id', '=', orgId)
      .where('data.data_sources.parent_data_source_id', 'is', null);

    if (options?.collectionId) {
      query = query.where('data.data_sources.collection_id', '=', options.collectionId);
    }

    if (options?.type) {
      query = query.where('data.data_sources.type', '=', options.type);
    }

    if (options?.hasCollection) {
      query = query.where('data.data_sources.collection_id', 'is not', null);
    }

    if (options?.rootOnly) {
      query = query.where('data.data_sources.collection_id', 'is', null);
    }

    if (options?.search) {
      const escaped = options.search.replace(/[%_]/g, '\\$&');
      query = query.where('data.data_sources.title', 'ilike', `%${escaped}%`);
    }

    const dataSources = await query.orderBy('data.data_sources.created_at', 'desc').execute();
    return dataSources.map((ds) => this.toResponse(ds));
  }

  async findById(orgId: DbId<'Org'>, id: DbId<'DataSource'>) {
    const dataSource = await this.db.kysely
      .selectFrom('data.data_sources')
      .leftJoin('data.contracts', 'data.contracts.data_source_id', 'data.data_sources.id')
      .selectAll('data.data_sources')
      .select('data.contracts.id as contract_id')
      .where('data.data_sources.id', '=', id)
      .where('data.data_sources.org_id', '=', orgId)
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
    const updated = await this.db.kysely
      .updateTable('data.data_sources')
      .set({ title, updated_at: new Date() })
      .where('id', '=', id)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (updated.numUpdatedRows === 0n) {
      throw new NotFoundException('Data source not found');
    }

    return this.findById(orgId, id);
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

  async move(orgId: DbId<'Org'>, id: DbId<'DataSource'>, collectionId: DbId<'Collection'> | null) {
    await this.db.kysely.transaction().execute(async (tx) => {
      if (collectionId !== null) {
        const target = await tx
          .selectFrom('data.collections')
          .select('id')
          .where('id', '=', collectionId)
          .where('org_id', '=', orgId)
          .executeTakeFirst();
        if (!target) {
          throw new NotFoundException('Target folder not found');
        }
      }

      const result = await tx
        .updateTable('data.data_sources')
        .set({ collection_id: collectionId, updated_at: new Date() })
        .where('id', '=', id)
        .where('org_id', '=', orgId)
        .executeTakeFirst();

      if (Number(result.numUpdatedRows) === 0) {
        throw new NotFoundException('Data source not found');
      }

      await tx
        .updateTable('data.chunks')
        .set({ collection_id: collectionId })
        .where('data_source_id', '=', id)
        .where('org_id', '=', orgId)
        .execute();
    });
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
    contract_id?: DbId<'Contract'> | null;
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
      contractId: ds.contract_id ?? null,
      createdAt: ds.created_at,
      updatedAt: ds.updated_at,
    };
  }
}
