import type { DbId } from '@grabdy/common';
import type { Kysely } from 'kysely';

import type { DB } from '../../db/db';

/**
 * Recursively collect all descendant data sources (children, grandchildren, etc.)
 * using a CTE. Handles PST -> Email -> Attachment hierarchies.
 */
export async function findDescendants(
  db: Kysely<DB>,
  orgId: DbId<'Org'>,
  parentId: DbId<'DataSource'>
): Promise<Array<{ id: DbId<'DataSource'>; storage_path: string | null }>> {
  return db
    .withRecursive('descendants', (qb) =>
      qb
        .selectFrom('data.data_sources')
        .select(['id', 'storage_path'])
        .where('parent_data_source_id', '=', parentId)
        .where('org_id', '=', orgId)
        .unionAll(
          qb
            .selectFrom('data.data_sources')
            .select(['data.data_sources.id', 'data.data_sources.storage_path'])
            .innerJoin('descendants', 'descendants.id', 'data.data_sources.parent_data_source_id')
            .where('data.data_sources.org_id', '=', orgId)
        )
    )
    .selectFrom('descendants')
    .select(['id', 'storage_path'])
    .execute();
}
