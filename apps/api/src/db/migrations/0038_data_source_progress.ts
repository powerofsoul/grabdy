import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE data.data_sources ADD COLUMN processing_progress SMALLINT DEFAULT 0`.execute(
    db
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE data.data_sources DROP COLUMN processing_progress`.execute(db);
}
