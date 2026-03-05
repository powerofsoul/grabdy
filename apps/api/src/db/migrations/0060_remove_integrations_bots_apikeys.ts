import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    -- 1. data.data_sources: drop connection-related indexes, constraints, and columns
    DROP INDEX IF EXISTS data.idx_data_sources_connection_external;
    ALTER TABLE data.data_sources DROP CONSTRAINT IF EXISTS fk_data_sources_connection;
    ALTER TABLE data.data_sources DROP CONSTRAINT IF EXISTS chk_data_sources_connection_org;
    ALTER TABLE data.data_sources DROP COLUMN IF EXISTS connection_id;
    ALTER TABLE data.data_sources DROP COLUMN IF EXISTS external_id;

    -- 2. sdk.bot_signing_keys: drop index, then table
    DROP INDEX IF EXISTS sdk.bot_signing_keys_bot_id_idx;
    DROP TABLE IF EXISTS sdk.bot_signing_keys CASCADE;

    -- 3. sdk.bots: drop index, then table
    DROP INDEX IF EXISTS sdk.bots_org_id_idx;
    DROP TABLE IF EXISTS sdk.bots CASCADE;

    -- 4. analytics.ai_usage_logs: drop bot-related index, constraint, and columns
    DROP INDEX IF EXISTS analytics.ai_usage_logs_bot_idx;
    ALTER TABLE analytics.ai_usage_logs DROP CONSTRAINT IF EXISTS chk_ai_usage_logs_bot_org;
    ALTER TABLE analytics.ai_usage_logs DROP COLUMN IF EXISTS bot_id;
    ALTER TABLE analytics.ai_usage_logs DROP COLUMN IF EXISTS external_user_id;

    -- 5. data.chat_threads: drop bot-related indexes, constraint, and columns
    DROP INDEX IF EXISTS data.chat_threads_bot_user_unique_idx;
    DROP INDEX IF EXISTS data.chat_threads_bot_member_lookup_idx;
    DROP INDEX IF EXISTS data.chat_threads_bot_lookup_idx;
    ALTER TABLE data.chat_threads DROP CONSTRAINT IF EXISTS chk_chat_threads_bot_org;
    ALTER TABLE data.chat_threads DROP COLUMN IF EXISTS bot_id;
    ALTER TABLE data.chat_threads DROP COLUMN IF EXISTS external_user_id;

    -- 6. chat_threads: update source values
    UPDATE data.chat_threads SET source = 'dashboard' WHERE source IN ('sdk', 'api');

    -- 7. api.api_keys: drop indexes, constraints, then table
    DROP INDEX IF EXISTS api.api_keys_org_id_idx;
    DROP INDEX IF EXISTS api.api_keys_key_prefix_idx;
    ALTER TABLE api.api_keys DROP CONSTRAINT IF EXISTS chk_api_keys_entity_type;
    ALTER TABLE api.api_keys DROP CONSTRAINT IF EXISTS chk_api_keys_org;
    DROP TABLE IF EXISTS api.api_keys CASCADE;

    -- 8. integration.connections: drop table (no separate indexes besides UNIQUE)
    DROP TABLE IF EXISTS integration.connections CASCADE
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    -- 1. Recreate integration.connections
    CREATE TABLE integration.connections (
      id                    UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.Connection)}),
      org_id                UUID NOT NULL REFERENCES org.orgs(id),
      provider              TEXT NOT NULL,
      status                TEXT NOT NULL DEFAULT 'ACTIVE',
      access_token          TEXT NOT NULL,
      refresh_token         TEXT,
      token_expires_at      TIMESTAMPTZ,
      scopes                TEXT[],
      external_account_id   TEXT,
      external_account_name TEXT,
      last_synced_at        TIMESTAMPTZ,
      provider_data         JSONB NOT NULL DEFAULT '{}',
      created_by_id         UUID NOT NULL REFERENCES auth.users(id),
      created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(org_id, provider)
    );
    ALTER TABLE integration.connections ADD CONSTRAINT chk_connections_entity_type
      CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.Connection)});
    ALTER TABLE integration.connections ADD CONSTRAINT chk_connections_org
      CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id));

    -- 2. Recreate api.api_keys
    CREATE TABLE api.api_keys (
      id            UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.ApiKey)}),
      org_id        UUID NOT NULL REFERENCES org.orgs(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      key_hash      TEXT NOT NULL,
      key_prefix    TEXT NOT NULL,
      created_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      last_used_at  TIMESTAMPTZ,
      revoked_at    TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX api_keys_org_id_idx ON api.api_keys (org_id);
    CREATE INDEX api_keys_key_prefix_idx ON api.api_keys (key_prefix);
    ALTER TABLE api.api_keys ADD CONSTRAINT chk_api_keys_entity_type
      CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.ApiKey)});
    ALTER TABLE api.api_keys ADD CONSTRAINT chk_api_keys_org
      CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id));

    -- 3. Recreate sdk.bots
    CREATE TABLE sdk.bots (
      id                UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.Bot)}),
      org_id            UUID NOT NULL REFERENCES org.orgs(id) ON DELETE CASCADE,
      name              TEXT NOT NULL,
      data_source_config JSONB NOT NULL DEFAULT '[]',
      system_prompt     TEXT,
      title             TEXT,
      subtitle          TEXT,
      placeholder       TEXT,
      image_key         TEXT,
      accent_color      TEXT,
      primary_color     TEXT,
      created_by_id     UUID NOT NULL REFERENCES auth.users(id),
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE sdk.bots ADD CONSTRAINT chk_bots_entity_type
      CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.Bot)});
    ALTER TABLE sdk.bots ADD CONSTRAINT chk_bots_org
      CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id));
    CREATE INDEX bots_org_id_idx ON sdk.bots (org_id);

    -- 4. Recreate sdk.bot_signing_keys
    CREATE TABLE sdk.bot_signing_keys (
      id              UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.BotSigningKey)}),
      bot_id          UUID NOT NULL REFERENCES sdk.bots(id) ON DELETE CASCADE,
      org_id          UUID NOT NULL REFERENCES org.orgs(id) ON DELETE CASCADE,
      name            TEXT NOT NULL DEFAULT 'default',
      public_key      TEXT NOT NULL,
      key_fingerprint TEXT NOT NULL,
      revoked_at      TIMESTAMPTZ,
      created_by_id   UUID NOT NULL REFERENCES auth.users(id),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE sdk.bot_signing_keys ADD CONSTRAINT chk_bot_signing_keys_entity_type
      CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.BotSigningKey)});
    ALTER TABLE sdk.bot_signing_keys ADD CONSTRAINT chk_bot_signing_keys_org
      CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id));
    ALTER TABLE sdk.bot_signing_keys ADD CONSTRAINT chk_bot_signing_keys_bot_org
      CHECK (extract_org_numeric_id(bot_id) = extract_org_numeric_id(org_id));
    CREATE INDEX bot_signing_keys_bot_id_idx ON sdk.bot_signing_keys (bot_id);

    -- 5. Re-add columns on data.chat_threads
    ALTER TABLE data.chat_threads
      ADD COLUMN bot_id UUID REFERENCES sdk.bots(id) ON DELETE SET NULL,
      ADD COLUMN external_user_id TEXT;
    ALTER TABLE data.chat_threads ADD CONSTRAINT chk_chat_threads_bot_org
      CHECK (bot_id IS NULL OR extract_org_numeric_id(bot_id) = extract_org_numeric_id(org_id));
    CREATE INDEX chat_threads_bot_lookup_idx
      ON data.chat_threads (bot_id, external_user_id) WHERE bot_id IS NOT NULL;
    CREATE UNIQUE INDEX chat_threads_bot_user_unique_idx
      ON data.chat_threads (bot_id, external_user_id, org_id)
      WHERE source = 'sdk' AND bot_id IS NOT NULL AND external_user_id IS NOT NULL;
    CREATE INDEX chat_threads_bot_member_lookup_idx
      ON data.chat_threads (bot_id, membership_id, updated_at DESC)
      WHERE bot_id IS NOT NULL AND membership_id IS NOT NULL;

    -- 6. Re-add columns on analytics.ai_usage_logs
    ALTER TABLE analytics.ai_usage_logs
      ADD COLUMN bot_id UUID,
      ADD COLUMN external_user_id TEXT;
    ALTER TABLE analytics.ai_usage_logs ADD CONSTRAINT chk_ai_usage_logs_bot_org
      CHECK (bot_id IS NULL OR extract_org_numeric_id(bot_id) = extract_org_numeric_id(org_id));
    CREATE INDEX ai_usage_logs_bot_idx
      ON analytics.ai_usage_logs (bot_id, created_at) WHERE bot_id IS NOT NULL;

    -- 7. Re-add columns on data.data_sources
    ALTER TABLE data.data_sources
      ADD COLUMN connection_id UUID,
      ADD COLUMN external_id TEXT;
    ALTER TABLE data.data_sources ADD CONSTRAINT fk_data_sources_connection
      FOREIGN KEY (connection_id) REFERENCES integration.connections(id) ON DELETE SET NULL;
    ALTER TABLE data.data_sources ADD CONSTRAINT chk_data_sources_connection_org
      CHECK (connection_id IS NULL OR extract_org_numeric_id(connection_id) = extract_org_numeric_id(org_id));
    CREATE UNIQUE INDEX idx_data_sources_connection_external
      ON data.data_sources(connection_id, external_id)
      WHERE connection_id IS NOT NULL AND external_id IS NOT NULL
  `.execute(db);
}
