import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE INDEX idx_data_sources_title_trgm ON data.data_sources USING gin (title gin_trgm_ops);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS data.idx_data_sources_title_trgm;
  `.execute(db);
}
