import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE data.chunks ADD COLUMN tsv tsvector
      GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
    CREATE INDEX chunks_tsv_idx ON data.chunks USING gin(tsv);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS data.chunks_tsv_idx;
    ALTER TABLE data.chunks DROP COLUMN IF EXISTS tsv;
  `.execute(db);
}
