import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE data.chat_threads
      ADD COLUMN source TEXT NOT NULL DEFAULT 'dashboard'
        CHECK (source IN ('dashboard', 'sdk', 'api')),
      ADD COLUMN sdk_chat_id UUID REFERENCES sdk.sdk_chats(id) ON DELETE SET NULL,
      ADD COLUMN external_user_id TEXT;

    ALTER TABLE data.chat_threads ALTER COLUMN membership_id DROP NOT NULL;

    ALTER TABLE data.chat_threads ADD CONSTRAINT chk_chat_threads_sdk_chat_org
      CHECK (sdk_chat_id IS NULL OR extract_org_numeric_id(sdk_chat_id) = extract_org_numeric_id(org_id));

    CREATE INDEX chat_threads_sdk_lookup_idx
      ON data.chat_threads (sdk_chat_id, external_user_id)
      WHERE sdk_chat_id IS NOT NULL;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS data.chat_threads_sdk_lookup_idx;
    ALTER TABLE data.chat_threads DROP CONSTRAINT IF EXISTS chk_chat_threads_sdk_chat_org;
    ALTER TABLE data.chat_threads ALTER COLUMN membership_id SET NOT NULL;
    ALTER TABLE data.chat_threads
      DROP COLUMN IF EXISTS external_user_id,
      DROP COLUMN IF EXISTS sdk_chat_id,
      DROP COLUMN IF EXISTS source;
  `.execute(db);
}
