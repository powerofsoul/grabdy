import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE INDEX chunks_ds_index_idx ON data.chunks (data_source_id, chunk_index);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS data.chunks_ds_index_idx;
  `.execute(db);
}
