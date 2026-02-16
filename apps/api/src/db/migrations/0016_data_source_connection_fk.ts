import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE data.data_sources ADD CONSTRAINT fk_data_sources_connection FOREIGN KEY (connection_id) REFERENCES integration.connections(id) ON DELETE SET NULL;
    CREATE UNIQUE INDEX idx_data_sources_connection_external ON data.data_sources(connection_id, external_id) WHERE connection_id IS NOT NULL AND external_id IS NOT NULL;
    ALTER TABLE data.data_sources ADD CONSTRAINT chk_data_sources_connection_org CHECK (connection_id IS NULL OR extract_org_numeric_id(connection_id) = extract_org_numeric_id(org_id));
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE data.data_sources DROP CONSTRAINT IF EXISTS chk_data_sources_connection_org;
    DROP INDEX IF EXISTS data.idx_data_sources_connection_external;
    ALTER TABLE data.data_sources DROP CONSTRAINT IF EXISTS fk_data_sources_connection;
  `.execute(db);
}
