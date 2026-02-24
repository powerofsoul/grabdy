import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // The ai_usage_logs table has an append-only trigger that blocks UPDATE/DELETE.
  // The ON DELETE SET NULL FK on sdk_chat_id triggers an UPDATE when an sdk_chat
  // is deleted, which the trigger rejects. Fix: drop the FK entirely so deleting
  // an sdk_chat is not blocked. The sdk_chat_id column is kept for analytics
  // (it becomes a soft reference). The org-consistency CHECK constraint is also
  // kept to prevent bad data on INSERT.
  await sql`
    ALTER TABLE analytics.ai_usage_logs
      DROP CONSTRAINT ai_usage_logs_sdk_chat_id_fkey;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE analytics.ai_usage_logs
      ADD CONSTRAINT ai_usage_logs_sdk_chat_id_fkey
        FOREIGN KEY (sdk_chat_id) REFERENCES sdk.sdk_chats(id) ON DELETE SET NULL;
  `.execute(db);
}
