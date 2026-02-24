import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE analytics.ai_usage_logs
      ADD COLUMN sdk_chat_id UUID REFERENCES sdk.sdk_chats(id) ON DELETE SET NULL,
      ADD COLUMN external_user_id TEXT;

    ALTER TABLE analytics.ai_usage_logs DROP CONSTRAINT IF EXISTS ai_usage_logs_source_check;
    ALTER TABLE analytics.ai_usage_logs ADD CONSTRAINT ai_usage_logs_source_check
      CHECK (source IN ('WEB', 'SLACK', 'API', 'MCP', 'SYSTEM', 'SDK'));

    ALTER TABLE analytics.ai_usage_logs DROP CONSTRAINT IF EXISTS ai_usage_logs_caller_type_check;
    ALTER TABLE analytics.ai_usage_logs ADD CONSTRAINT ai_usage_logs_caller_type_check
      CHECK (caller_type IN ('MEMBER', 'SYSTEM', 'API_KEY', 'SDK_JWT'));

    ALTER TABLE analytics.ai_usage_logs ADD CONSTRAINT chk_ai_usage_logs_sdk_chat_org
      CHECK (sdk_chat_id IS NULL OR extract_org_numeric_id(sdk_chat_id) = extract_org_numeric_id(org_id));

    CREATE INDEX ai_usage_logs_sdk_chat_idx
      ON analytics.ai_usage_logs (sdk_chat_id, created_at)
      WHERE sdk_chat_id IS NOT NULL;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS analytics.ai_usage_logs_sdk_chat_idx;
    ALTER TABLE analytics.ai_usage_logs DROP CONSTRAINT IF EXISTS chk_ai_usage_logs_sdk_chat_org;

    ALTER TABLE analytics.ai_usage_logs DROP CONSTRAINT IF EXISTS ai_usage_logs_caller_type_check;
    ALTER TABLE analytics.ai_usage_logs ADD CONSTRAINT ai_usage_logs_caller_type_check
      CHECK (caller_type IN ('MEMBER', 'SYSTEM', 'API_KEY'));

    ALTER TABLE analytics.ai_usage_logs DROP CONSTRAINT IF EXISTS ai_usage_logs_source_check;
    ALTER TABLE analytics.ai_usage_logs ADD CONSTRAINT ai_usage_logs_source_check
      CHECK (source IN ('WEB', 'SLACK', 'API', 'MCP', 'SYSTEM'));

    ALTER TABLE analytics.ai_usage_logs
      DROP COLUMN IF EXISTS external_user_id,
      DROP COLUMN IF EXISTS sdk_chat_id;
  `.execute(db);
}
