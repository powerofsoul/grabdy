import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE INDEX chat_threads_bot_lookup_idx
      ON data.chat_threads (sdk_chat_id, membership_id, updated_at DESC)
      WHERE sdk_chat_id IS NOT NULL AND membership_id IS NOT NULL;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS data.chat_threads_bot_lookup_idx;
  `.execute(db);
}
