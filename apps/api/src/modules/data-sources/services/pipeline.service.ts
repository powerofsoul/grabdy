import { Injectable, Logger } from '@nestjs/common';

import { type DbId, dbIdSchema, extractOrgNumericId, packId } from '@grabdy/common';
import type { ChunkMeta } from '@grabdy/contracts';

import { DbService } from '../../../db/db.module';
import { StorageKeys } from '../../storage/file-storage.interface';
import { S3FileStorage } from '../../storage/s3-file-storage';

import type { BatchPlan, DocumentMetadata } from './chunking/extractor.interface';

// ── Batch sizing constants ──────────────────────────────────────────
const PDF_BATCH_PAGES = 30;
const PDF_OVERLAP = 5;
const DOCX_BATCH_PAGES = 30;
const DOCX_OVERLAP = 5;
const XLSX_BATCH_ROWS = 500;
const XLSX_OVERLAP = 50;
const CSV_BATCH_ROWS = 500;
const CSV_OVERLAP = 50;
const TEXT_BATCH_CHARS = 50_000;
const TEXT_OVERLAP = 2_000;

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private db: DbService,
    private storage: S3FileStorage
  ) {}

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

  async computeBatches(mimeType: string, metadata: DocumentMetadata): Promise<BatchPlan[]> {
    // PDF
    if (mimeType === 'application/pdf') {
      return buildRangeBatches(metadata.pageCount ?? 1, PDF_BATCH_PAGES, PDF_OVERLAP);
    }

    // DOCX
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      return buildRangeBatches(metadata.pageCount ?? 1, DOCX_BATCH_PAGES, DOCX_OVERLAP);
    }

    // XLSX: one set of batches per sheet
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel'
    ) {
      const sheets = metadata.sheetNames ?? ['Sheet1'];
      const batches: BatchPlan[] = [];
      let batchIndex = 0;
      for (const sheet of sheets) {
        const rowCount = metadata.rowCount ?? 1;
        const sheetBatches = buildRangeBatches(rowCount, XLSX_BATCH_ROWS, XLSX_OVERLAP);
        for (const b of sheetBatches) {
          batches.push({ ...b, batchIndex, sheet });
          batchIndex++;
        }
      }
      return batches;
    }

    // CSV
    if (mimeType === 'text/csv') {
      return buildRangeBatches(metadata.rowCount ?? 1, CSV_BATCH_ROWS, CSV_OVERLAP);
    }

    // EMAIL / IMAGE: single batch
    if (
      mimeType === 'message/rfc822' ||
      mimeType === 'application/vnd.ms-outlook' ||
      mimeType === 'application/vnd.ms-outlook-pst' ||
      mimeType.startsWith('image/')
    ) {
      return [{ batchIndex: 0, startUnit: 1, endUnit: 1, overlapBefore: 0, overlapAfter: 0 }];
    }

    // TXT / JSON: character-based batching
    if (mimeType === 'text/plain' || mimeType === 'application/json') {
      const charCount = metadata.charCount ?? metadata.fileSize;
      return buildRangeBatches(charCount, TEXT_BATCH_CHARS, TEXT_OVERLAP);
    }

    // Fallback: single batch
    return [{ batchIndex: 0, startUnit: 1, endUnit: 1, overlapBefore: 0, overlapAfter: 0 }];
  }

  async storeExtractedImages(params: {
    dataSourceId: DbId<'DataSource'>;
    orgId: DbId<'Org'>;
    images: Array<{
      buffer: Buffer;
      mimeType: string;
      pageNumber?: number;
      aiDescription?: string;
      width?: number;
      height?: number;
    }>;
  }): Promise<Array<DbId<'ExtractedImage'>>> {
    const dataSourceId = dbIdSchema('DataSource').parse(params.dataSourceId);
    const orgId = dbIdSchema('Org').parse(params.orgId);
    const orgNum = extractOrgNumericId(orgId);

    if (params.images.length === 0) return [];

    const imageIds: Array<DbId<'ExtractedImage'>> = [];

    for (let i = 0; i < params.images.length; i++) {
      const img = params.images[i];
      const imageId = packId('ExtractedImage', orgNum);
      const storagePath = StorageKeys.extractedImage(orgId, dataSourceId, imageId);

      await this.storage.put(storagePath, img.buffer, img.mimeType);

      await this.db.kysely
        .insertInto('data.extracted_images')
        .values({
          id: imageId,
          data_source_id: dataSourceId,
          storage_path: storagePath,
          mime_type: img.mimeType,
          page_number: img.pageNumber ?? null,
          ai_description: img.aiDescription ?? null,
          width: img.width ?? null,
          height: img.height ?? null,
          file_size: img.buffer.length,
          org_id: orgId,
        })
        .execute();

      imageIds.push(imageId);
    }

    return imageIds;
  }

  async storeChunksWithoutEmbeddings(params: {
    dataSourceId: DbId<'DataSource'>;
    collectionId: DbId<'Collection'> | null;
    orgId: DbId<'Org'>;
    chunkIndexOffset: number;
    chunks: Array<{
      content: string;
      metadata: ChunkMeta;
      sourceUrl: string | null;
      sourceKey: string | null;
      embeddingContext?: string;
      extractedImageId?: DbId<'ExtractedImage'>;
    }>;
  }): Promise<number> {
    const dataSourceId = dbIdSchema('DataSource').parse(params.dataSourceId);
    const orgId = dbIdSchema('Org').parse(params.orgId);
    const collectionId = params.collectionId
      ? dbIdSchema('Collection').parse(params.collectionId)
      : null;
    const orgNum = extractOrgNumericId(orgId);

    if (params.chunks.length === 0) return 0;

    const values = params.chunks.map((chunk, idx) => ({
      id: packId('Chunk', orgNum),
      content: chunk.content,
      chunk_index: params.chunkIndexOffset + idx,
      metadata: chunk.metadata,
      source_url: chunk.sourceUrl,
      source_key: chunk.sourceKey,
      embedding: null,
      embedding_context: chunk.embeddingContext ?? null,
      extracted_image_id: chunk.extractedImageId ?? null,
      data_source_id: dataSourceId,
      collection_id: collectionId,
      org_id: orgId,
    }));

    await this.db.kysely.insertInto('data.chunks').values(values).execute();

    return params.chunks.length;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function buildRangeBatches(totalUnits: number, batchSize: number, overlap: number): BatchPlan[] {
  if (totalUnits <= 0) {
    return [{ batchIndex: 0, startUnit: 1, endUnit: 1, overlapBefore: 0, overlapAfter: 0 }];
  }

  const batches: BatchPlan[] = [];
  let batchIndex = 0;

  for (let start = 1; start <= totalUnits; start += batchSize) {
    const end = Math.min(start + batchSize - 1, totalUnits);
    const overlapBefore = start > 1 ? Math.min(overlap, start - 1) : 0;
    const overlapAfter = end < totalUnits ? Math.min(overlap, totalUnits - end) : 0;

    batches.push({
      batchIndex,
      startUnit: start,
      endUnit: end,
      overlapBefore,
      overlapAfter,
    });

    batchIndex++;
  }

  return batches;
}
