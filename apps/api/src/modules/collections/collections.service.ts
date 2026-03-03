import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { type DbId, packId } from '@grabdy/common';
import { Queue } from 'bullmq';
import { type Kysely, sql } from 'kysely';

import type { DB } from '../../db/db';
import { DbService } from '../../db/db.module';
import { InjectTypedQueue } from '../../queue/queue.decorators';

@Injectable()
export class CollectionsService {
  constructor(
    private db: DbService,
    @InjectTypedQueue('data-source-cleanup') private cleanupQueue: Queue
  ) {}

  async create(
    orgId: DbId<'Org'>,
    data: { name: string; description?: string; parentId?: DbId<'Collection'> }
  ) {
    if (data.parentId) {
      const parent = await this.db.kysely
        .selectFrom('data.collections')
        .select('id')
        .where('id', '=', data.parentId)
        .where('org_id', '=', orgId)
        .executeTakeFirst();
      if (!parent) {
        throw new NotFoundException('Parent folder not found');
      }
    }

    const collection = await this.db.kysely
      .insertInto('data.collections')
      .values({
        id: packId('Collection', orgId),
        name: data.name,
        description: data.description ?? null,
        parent_id: data.parentId ?? null,
        org_id: orgId,
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      parentId: collection.parent_id,
      orgId: collection.org_id,
      sourceCount: 0,
      chunkCount: 0,
      createdAt: collection.created_at,
      updatedAt: collection.updated_at,
    };
  }

  async list(orgId: DbId<'Org'>, filters?: { parentId?: DbId<'Collection'> }) {
    let query = this.db.kysely
      .selectFrom('data.collections')
      .select([
        'data.collections.id',
        'data.collections.name',
        'data.collections.description',
        'data.collections.parent_id',
        'data.collections.org_id',
        'data.collections.created_at',
        'data.collections.updated_at',
        sql<number>`(select count(*) from data.data_sources where data.data_sources.collection_id = data.collections.id)`.as(
          'source_count'
        ),
        sql<number>`(select count(*) from data.chunks where data.chunks.collection_id = data.collections.id)`.as(
          'chunk_count'
        ),
      ])
      .where('data.collections.org_id', '=', orgId);

    if (filters?.parentId) {
      query = query.where('data.collections.parent_id', '=', filters.parentId);
    }

    const collections = await query.orderBy('data.collections.name', 'asc').execute();

    return collections.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      parentId: c.parent_id,
      orgId: c.org_id,
      sourceCount: Number(c.source_count),
      chunkCount: Number(c.chunk_count),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
  }

  async findById(orgId: DbId<'Org'>, collectionId: DbId<'Collection'>, db?: Kysely<DB>) {
    const conn = db ?? this.db.kysely;
    const result = await conn
      .selectFrom('data.collections')
      .select([
        'data.collections.id',
        'data.collections.name',
        'data.collections.description',
        'data.collections.parent_id',
        'data.collections.org_id',
        'data.collections.created_at',
        'data.collections.updated_at',
        sql<number>`(select count(*) from data.data_sources where data.data_sources.collection_id = data.collections.id)`.as(
          'source_count'
        ),
        sql<number>`(select count(*) from data.chunks where data.chunks.collection_id = data.collections.id)`.as(
          'chunk_count'
        ),
      ])
      .where('data.collections.id', '=', collectionId)
      .where('data.collections.org_id', '=', orgId)
      .executeTakeFirst();

    if (!result) {
      throw new NotFoundException('Collection not found');
    }

    return {
      id: result.id,
      name: result.name,
      description: result.description,
      parentId: result.parent_id,
      orgId: result.org_id,
      sourceCount: Number(result.source_count),
      chunkCount: Number(result.chunk_count),
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  async update(
    orgId: DbId<'Org'>,
    collectionId: DbId<'Collection'>,
    data: { name?: string; description?: string | null; parentId?: DbId<'Collection'> | null }
  ) {
    return this.db.kysely.transaction().execute(async (tx) => {
      if (data.parentId !== undefined) {
        // Lock the source row to prevent concurrent moves creating cycles (A->B + B->A)
        await tx
          .selectFrom('data.collections')
          .select('id')
          .where('id', '=', collectionId)
          .where('org_id', '=', orgId)
          .forUpdate()
          .executeTakeFirst();

        // parentId === null means move to root, which is always valid
        if (data.parentId !== null) {
          if (data.parentId === collectionId) {
            throw new BadRequestException('Cannot move a folder into itself');
          }
          // Lock the target collection row as well
          const parent = await tx
            .selectFrom('data.collections')
            .select('id')
            .where('id', '=', data.parentId)
            .where('org_id', '=', orgId)
            .forUpdate()
            .executeTakeFirst();
          if (!parent) {
            throw new NotFoundException('Parent folder not found');
          }
          // Validate no circular reference - new parent cannot be a descendant
          const descendants = await this.getDescendantIds(orgId, collectionId, tx);
          if (descendants.some((d) => d === data.parentId)) {
            throw new BadRequestException('Cannot move a folder into one of its subfolders');
          }
        }
      }

      const result = await tx
        .updateTable('data.collections')
        .set({
          updated_at: new Date(),
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.parentId !== undefined ? { parent_id: data.parentId } : {}),
        })
        .where('id', '=', collectionId)
        .where('org_id', '=', orgId)
        .returningAll()
        .executeTakeFirst();

      if (!result) {
        throw new NotFoundException('Collection not found');
      }

      return this.findById(orgId, collectionId, tx);
    });
  }

  async delete(orgId: DbId<'Org'>, collectionId: DbId<'Collection'>) {
    // Run the entire delete flow in a transaction to prevent orphaned data sources
    const dataSources = await this.db.kysely.transaction().execute(async (tx) => {
      // Collect all collection IDs in the tree (this collection + descendants)
      const descendantIds = await this.getDescendantIds(orgId, collectionId, tx);
      const allCollectionIds = [collectionId, ...descendantIds];

      // Find all data sources in these collections and lock them
      const sources = await tx
        .selectFrom('data.data_sources')
        .select(['id', 'storage_path'])
        .where('collection_id', 'in', allCollectionIds)
        .where('org_id', '=', orgId)
        .forUpdate()
        .execute();

      if (sources.length > 0) {
        // Mark all as DELETING
        await tx
          .updateTable('data.data_sources')
          .set({ status: 'DELETING', updated_at: new Date() })
          .where('collection_id', 'in', allCollectionIds)
          .where('org_id', '=', orgId)
          .execute();
      }

      // Delete the collection (cascades to child collections via ON DELETE CASCADE)
      const result = await tx
        .deleteFrom('data.collections')
        .where('id', '=', collectionId)
        .where('org_id', '=', orgId)
        .executeTakeFirst();

      if (result.numDeletedRows === 0n) {
        throw new NotFoundException('Collection not found');
      }

      return sources;
    });

    // Queue cleanup jobs outside the transaction (BullMQ is not transactional)
    if (dataSources.length > 0) {
      await this.cleanupQueue.addBulk(
        dataSources.map((ds) => ({
          name: 'cleanup',
          data: {
            orgId,
            dataSourceId: ds.id,
            storagePath: ds.storage_path,
          },
        }))
      );
    }
  }

  async getDescendantIds(
    orgId: DbId<'Org'>,
    collectionId: DbId<'Collection'>,
    db?: Kysely<DB>
  ): Promise<DbId<'Collection'>[]> {
    return this.getDescendantIdsForMultiple(orgId, [collectionId], db);
  }

  async getDescendantIdsForMultiple(
    orgId: DbId<'Org'>,
    collectionIds: DbId<'Collection'>[],
    db?: Kysely<DB>
  ): Promise<DbId<'Collection'>[]> {
    if (collectionIds.length === 0) return [];
    const conn = db ?? this.db.kysely;

    const rows = await conn
      .withRecursive('descendants', (qb) =>
        qb
          .selectFrom('data.collections')
          .select('id')
          .where('parent_id', 'in', collectionIds)
          .where('org_id', '=', orgId)
          .union(
            qb
              .selectFrom('data.collections')
              .select('data.collections.id')
              .innerJoin('descendants', 'descendants.id', 'data.collections.parent_id')
              .where('data.collections.org_id', '=', orgId)
          )
      )
      .selectFrom('descendants')
      .select('id')
      .execute();

    return rows.map((r) => r.id);
  }
}
