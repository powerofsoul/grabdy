import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE SCHEMA IF NOT EXISTS integration;

    CREATE TABLE integration.connections (
      id UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.Connection)}),
      provider TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_expires_at TIMESTAMPTZ,
      scopes TEXT[],
      external_account_id TEXT,
      external_account_name TEXT,
      last_synced_at TIMESTAMPTZ,
      provider_data JSONB NOT NULL DEFAULT '{}',
      org_id UUID NOT NULL REFERENCES org.orgs(id),
      created_by_id UUID NOT NULL REFERENCES auth.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(org_id, provider),
      CONSTRAINT chk_connections_entity_type CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.Connection)}),
      CONSTRAINT chk_connections_org CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id))
    );
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS integration.sync_logs;
    DROP TABLE IF EXISTS integration.connections;
    DROP SCHEMA IF EXISTS integration;
  `.execute(db);
}
