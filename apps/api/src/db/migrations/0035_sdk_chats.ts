import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE SCHEMA IF NOT EXISTS sdk;

    CREATE TABLE sdk.sdk_chats (
      id                  UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.Bot)}),
      org_id              UUID NOT NULL REFERENCES org.orgs(id) ON DELETE CASCADE,
      name                TEXT NOT NULL,
      data_source_config  JSONB NOT NULL DEFAULT '[]',
      system_prompt       TEXT,
      settings            JSONB NOT NULL DEFAULT '{}',
      is_active           BOOLEAN NOT NULL DEFAULT true,
      created_by_id       UUID NOT NULL REFERENCES auth.users(id),
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE sdk.sdk_chats ADD CONSTRAINT chk_sdk_chats_entity_type CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.Bot)});
    ALTER TABLE sdk.sdk_chats ADD CONSTRAINT chk_sdk_chats_org CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id));

    CREATE INDEX sdk_chats_org_id_idx ON sdk.sdk_chats (org_id);

    CREATE TABLE sdk.sdk_signing_keys (
      id                  UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.BotSigningKey)}),
      sdk_chat_id         UUID NOT NULL REFERENCES sdk.sdk_chats(id) ON DELETE CASCADE,
      org_id              UUID NOT NULL REFERENCES org.orgs(id) ON DELETE CASCADE,
      name                TEXT NOT NULL DEFAULT 'default',
      public_key          TEXT NOT NULL,
      key_fingerprint     TEXT NOT NULL,
      revoked_at          TIMESTAMPTZ,
      created_by_id       UUID NOT NULL REFERENCES auth.users(id),
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE sdk.sdk_signing_keys ADD CONSTRAINT chk_sdk_signing_keys_entity_type CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.BotSigningKey)});
    ALTER TABLE sdk.sdk_signing_keys ADD CONSTRAINT chk_sdk_signing_keys_org CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id));
    ALTER TABLE sdk.sdk_signing_keys ADD CONSTRAINT chk_sdk_signing_keys_sdk_chat_org CHECK (extract_org_numeric_id(sdk_chat_id) = extract_org_numeric_id(org_id));

    CREATE INDEX sdk_signing_keys_chat_id_idx ON sdk.sdk_signing_keys (sdk_chat_id);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS sdk.sdk_signing_keys CASCADE;
    DROP TABLE IF EXISTS sdk.sdk_chats CASCADE;
    DROP SCHEMA IF EXISTS sdk CASCADE;
  `.execute(db);
}
