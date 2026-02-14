import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';

import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { type DbId, extractOrgNumericId, packId } from '@grabdy/common';
import { Queue } from 'bullmq';

import { InjectEnv } from '../../config/env.config';
import { DbService } from '../../db/db.module';
import type { DataSourceStatus, DataSourceType } from '../../db/enums';
import type { DataSourceJobData } from '../queue/processors/data-source.processor';
import { DATA_SOURCE_QUEUE } from '../queue/queue.constants';

const MIME_TO_TYPE: Record<string, DataSourceType> = {
  'application/pdf': 'PDF',
  'text/csv': 'CSV',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'text/plain': 'TXT',
  'application/json': 'JSON',
};

@Injectable()
export class DataSourcesService {
  private readonly s3: S3Client;

  constructor(
    private db: DbService,
    @InjectQueue(DATA_SOURCE_QUEUE) private dataSourceQueue: Queue,
    @InjectEnv('s3UploadsBucket') private readonly bucket: string,
    @InjectEnv('awsRegion') awsRegion: string
  ) {
    this.s3 = new S3Client({ region: awsRegion });
  }

  async upload(
    orgId: DbId<'Org'>,
    userId: DbId<'User'>,
    file: Express.Multer.File,
    options: { name?: string; collectionId?: DbId<'Collection'> }
  ) {
    const type = MIME_TO_TYPE[file.mimetype];
    if (!type) {
      throw new Error(`Unsupported file type: ${file.mimetype}`);
    }

    // S3 key: {orgNumericId}/{timestamp}-{originalname}
    const orgNum = extractOrgNumericId(orgId).toString();
    const filename = `${Date.now()}-${file.originalname}`;
    const s3Key = `${orgNum}/${filename}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ServerSideEncryption: 'AES256',
      })
    );

    const collectionId = options.collectionId ?? null;

    const dataSource = await this.db.kysely
      .insertInto('data.data_sources')
      .values({
        id: packId('DataSource', orgId),
        name: options.name ?? file.originalname,
        filename: file.originalname,
        mime_type: file.mimetype,
        file_size: file.size,
        storage_path: s3Key,
        type,
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
      storagePath: s3Key,
      mimeType: file.mimetype,
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

    // Delete chunks first
    await this.db.kysely.deleteFrom('data.chunks').where('data_source_id', '=', id).execute();

    // Delete the record
    await this.db.kysely.deleteFrom('data.data_sources').where('id', '=', id).execute();

    // Delete file from S3
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: dataSource.storage_path,
      })
    );
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
    await this.db.kysely.deleteFrom('data.chunks').where('data_source_id', '=', id).execute();

    // Reset status
    await this.db.kysely
      .updateTable('data.data_sources')
      .set({ status: 'UPLOADED', updated_at: new Date() })
      .where('id', '=', id)
      .execute();

    // Re-queue
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
    name: string;
    filename: string;
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
      name: ds.name,
      filename: ds.filename,
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
