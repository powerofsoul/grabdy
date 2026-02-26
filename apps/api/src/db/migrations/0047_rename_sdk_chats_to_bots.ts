import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    -- Rename main tables
    ALTER TABLE sdk.sdk_chats RENAME TO bots;
    ALTER TABLE sdk.sdk_signing_keys RENAME TO bot_signing_keys;

    -- Rename columns
    ALTER TABLE sdk.bot_signing_keys RENAME COLUMN sdk_chat_id TO bot_id;
    ALTER TABLE data.chat_threads RENAME COLUMN sdk_chat_id TO bot_id;
    ALTER TABLE analytics.ai_usage_logs RENAME COLUMN sdk_chat_id TO bot_id;

    -- Rename constraints on sdk.bots (was sdk.sdk_chats)
    ALTER TABLE sdk.bots RENAME CONSTRAINT chk_sdk_chats_entity_type TO chk_bots_entity_type;
    ALTER TABLE sdk.bots RENAME CONSTRAINT chk_sdk_chats_org TO chk_bots_org;

    -- Rename constraints on sdk.bot_signing_keys (was sdk.sdk_signing_keys)
    ALTER TABLE sdk.bot_signing_keys RENAME CONSTRAINT chk_sdk_signing_keys_entity_type TO chk_bot_signing_keys_entity_type;
    ALTER TABLE sdk.bot_signing_keys RENAME CONSTRAINT chk_sdk_signing_keys_org TO chk_bot_signing_keys_org;
    ALTER TABLE sdk.bot_signing_keys RENAME CONSTRAINT chk_sdk_signing_keys_sdk_chat_org TO chk_bot_signing_keys_bot_org;

    -- Rename constraints on data.chat_threads
    ALTER TABLE data.chat_threads RENAME CONSTRAINT chk_chat_threads_sdk_chat_org TO chk_chat_threads_bot_org;

    -- Rename constraints on analytics.ai_usage_logs
    ALTER TABLE analytics.ai_usage_logs RENAME CONSTRAINT chk_ai_usage_logs_sdk_chat_org TO chk_ai_usage_logs_bot_org;

    -- Rename indexes (drop and recreate since ALTER INDEX RENAME is PG-specific)
    ALTER INDEX sdk.sdk_chats_org_id_idx RENAME TO bots_org_id_idx;
    ALTER INDEX sdk.sdk_signing_keys_chat_id_idx RENAME TO bot_signing_keys_bot_id_idx;
    ALTER INDEX data.chat_threads_bot_lookup_idx RENAME TO chat_threads_bot_member_lookup_idx;
    ALTER INDEX data.chat_threads_sdk_lookup_idx RENAME TO chat_threads_bot_lookup_idx;
    ALTER INDEX data.chat_threads_sdk_user_unique_idx RENAME TO chat_threads_bot_user_unique_idx;
    ALTER INDEX analytics.ai_usage_logs_sdk_chat_idx RENAME TO ai_usage_logs_bot_idx;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    -- Reverse index renames
    ALTER INDEX analytics.ai_usage_logs_bot_idx RENAME TO ai_usage_logs_sdk_chat_idx;
    ALTER INDEX data.chat_threads_bot_lookup_idx RENAME TO chat_threads_sdk_lookup_idx;
    ALTER INDEX data.chat_threads_bot_user_unique_idx RENAME TO chat_threads_sdk_user_unique_idx;
    ALTER INDEX data.chat_threads_bot_member_lookup_idx RENAME TO chat_threads_bot_lookup_idx;
    ALTER INDEX sdk.bot_signing_keys_bot_id_idx RENAME TO sdk_signing_keys_chat_id_idx;
    ALTER INDEX sdk.bots_org_id_idx RENAME TO sdk_chats_org_id_idx;

    -- Reverse constraint renames
    ALTER TABLE analytics.ai_usage_logs RENAME CONSTRAINT chk_ai_usage_logs_bot_org TO chk_ai_usage_logs_sdk_chat_org;
    ALTER TABLE data.chat_threads RENAME CONSTRAINT chk_chat_threads_bot_org TO chk_chat_threads_sdk_chat_org;
    ALTER TABLE sdk.bot_signing_keys RENAME CONSTRAINT chk_bot_signing_keys_bot_org TO chk_sdk_signing_keys_sdk_chat_org;
    ALTER TABLE sdk.bot_signing_keys RENAME CONSTRAINT chk_bot_signing_keys_org TO chk_sdk_signing_keys_org;
    ALTER TABLE sdk.bot_signing_keys RENAME CONSTRAINT chk_bot_signing_keys_entity_type TO chk_sdk_signing_keys_entity_type;
    ALTER TABLE sdk.bots RENAME CONSTRAINT chk_bots_org TO chk_sdk_chats_org;
    ALTER TABLE sdk.bots RENAME CONSTRAINT chk_bots_entity_type TO chk_sdk_chats_entity_type;

    -- Reverse column renames
    ALTER TABLE analytics.ai_usage_logs RENAME COLUMN bot_id TO sdk_chat_id;
    ALTER TABLE data.chat_threads RENAME COLUMN bot_id TO sdk_chat_id;
    ALTER TABLE sdk.bot_signing_keys RENAME COLUMN bot_id TO sdk_chat_id;

    -- Reverse table renames
    ALTER TABLE sdk.bot_signing_keys RENAME TO sdk_signing_keys;
    ALTER TABLE sdk.bots RENAME TO sdk_chats;
  `.execute(db);
}
