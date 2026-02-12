import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE data.chat_threads ADD COLUMN canvas_state JSONB DEFAULT NULL;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE data.chat_threads DROP COLUMN IF EXISTS canvas_state;
  `.execute(db);
}
