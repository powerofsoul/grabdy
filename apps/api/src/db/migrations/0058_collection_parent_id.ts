import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE data.collections
      ADD COLUMN parent_id UUID REFERENCES data.collections(id) ON DELETE CASCADE;

    ALTER TABLE data.collections
      ADD CONSTRAINT chk_collections_no_self_parent CHECK (parent_id != id);

    ALTER TABLE data.collections
      ADD CONSTRAINT chk_collections_parent_org
        CHECK (parent_id IS NULL OR extract_org_numeric_id(parent_id) = extract_org_numeric_id(org_id));

    CREATE INDEX idx_collections_parent_id ON data.collections (parent_id);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS data.idx_collections_parent_id;
    ALTER TABLE data.collections DROP CONSTRAINT IF EXISTS chk_collections_parent_org;
    ALTER TABLE data.collections DROP CONSTRAINT IF EXISTS chk_collections_no_self_parent;
    ALTER TABLE data.collections DROP COLUMN IF EXISTS parent_id;
  `.execute(db);
}
