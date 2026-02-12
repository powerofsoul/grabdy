import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE data.collections (
      id UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.Collection)}),
      name TEXT NOT NULL,
      description TEXT,
      org_id UUID NOT NULL REFERENCES org.orgs(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX collections_org_id_idx ON data.collections (org_id);
    ALTER TABLE data.collections ADD CONSTRAINT chk_collections_entity_type CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.Collection)});
    ALTER TABLE data.collections ADD CONSTRAINT chk_collections_org CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id));
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS data.collections CASCADE`.execute(db);
}
