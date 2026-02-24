import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE UNIQUE INDEX chat_threads_sdk_user_unique_idx
      ON data.chat_threads (sdk_chat_id, external_user_id, org_id)
      WHERE source = 'sdk' AND sdk_chat_id IS NOT NULL AND external_user_id IS NOT NULL;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS data.chat_threads_sdk_user_unique_idx;
  `.execute(db);
}
