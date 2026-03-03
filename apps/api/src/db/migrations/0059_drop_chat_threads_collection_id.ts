import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE data.chat_threads DROP COLUMN IF EXISTS collection_id`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE data.chat_threads ADD COLUMN collection_id UUID`.execute(db);
}
