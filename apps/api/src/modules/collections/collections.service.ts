import { Injectable, NotFoundException } from '@nestjs/common';

import { type DbId, packId } from '@grabdy/common';
import { sql } from 'kysely';

import { DbService } from '../../db/db.module';

@Injectable()
export class CollectionsService {
  constructor(private db: DbService) {}

  async create(orgId: DbId<'Org'>, data: { name: string; description?: string }) {
    const collection = await this.db.kysely
      .insertInto('data.collections')
      .values({
        id: packId('Collection', orgId),
        name: data.name,
        description: data.description ?? null,
        org_id: orgId,
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      orgId: collection.org_id,
      sourceCount: 0,
      chunkCount: 0,
      createdAt: collection.created_at,
      updatedAt: collection.updated_at,
    };
  }

  async list(orgId: DbId<'Org'>) {
    const collections = await this.db.kysely
      .selectFrom('data.collections')
      .leftJoin('data.data_sources', 'data.data_sources.collection_id', 'data.collections.id')
      .leftJoin('data.chunks', 'data.chunks.collection_id', 'data.collections.id')
      .select([
        'data.collections.id',
        'data.collections.name',
        'data.collections.description',
        'data.collections.org_id',
        'data.collections.created_at',
        'data.collections.updated_at',
        sql<number>`count(distinct data.data_sources.id)`.as('source_count'),
        sql<number>`count(distinct data.chunks.id)`.as('chunk_count'),
      ])
      .where('data.collections.org_id', '=', orgId)
      .groupBy('data.collections.id')
      .execute();

    return collections.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      orgId: c.org_id,
      sourceCount: Number(c.source_count),
      chunkCount: Number(c.chunk_count),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    }));
  }

  async findById(orgId: DbId<'Org'>, collectionId: DbId<'Collection'>) {
    const result = await this.db.kysely
      .selectFrom('data.collections')
      .leftJoin('data.data_sources', 'data.data_sources.collection_id', 'data.collections.id')
      .leftJoin('data.chunks', 'data.chunks.collection_id', 'data.collections.id')
      .select([
        'data.collections.id',
        'data.collections.name',
        'data.collections.description',
        'data.collections.org_id',
        'data.collections.created_at',
        'data.collections.updated_at',
        sql<number>`count(distinct data.data_sources.id)`.as('source_count'),
        sql<number>`count(distinct data.chunks.id)`.as('chunk_count'),
      ])
      .where('data.collections.id', '=', collectionId)
      .where('data.collections.org_id', '=', orgId)
      .groupBy('data.collections.id')
      .executeTakeFirst();

    if (!result) {
      throw new NotFoundException('Collection not found');
    }

    return {
      id: result.id,
      name: result.name,
      description: result.description,
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
    data: { name?: string; description?: string | null }
  ) {
    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;

    const collection = await this.db.kysely
      .updateTable('data.collections')
      .set(updates)
      .where('id', '=', collectionId)
      .where('org_id', '=', orgId)
      .returningAll()
      .executeTakeFirst();

    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    return this.findById(orgId, collectionId);
  }

  async delete(orgId: DbId<'Org'>, collectionId: DbId<'Collection'>) {
    const result = await this.db.kysely
      .deleteFrom('data.collections')
      .where('id', '=', collectionId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (result.numDeletedRows === 0n) {
      throw new NotFoundException('Collection not found');
    }
  }
}
