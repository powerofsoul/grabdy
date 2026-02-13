import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE data.data_sources ADD COLUMN connection_id UUID REFERENCES data.connections(id) ON DELETE SET NULL;
    ALTER TABLE data.data_sources ADD COLUMN external_id TEXT;
    CREATE UNIQUE INDEX idx_data_sources_connection_external ON data.data_sources(connection_id, external_id) WHERE connection_id IS NOT NULL AND external_id IS NOT NULL;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS data.idx_data_sources_connection_external;
    ALTER TABLE data.data_sources DROP COLUMN IF EXISTS external_id;
    ALTER TABLE data.data_sources DROP COLUMN IF EXISTS connection_id;
  `.execute(db);
}
