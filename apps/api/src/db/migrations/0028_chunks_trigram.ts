import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE INDEX chunks_content_trgm_idx ON data.chunks USING gin(content gin_trgm_ops);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS data.chunks_content_trgm_idx;
  `.execute(db);
}
