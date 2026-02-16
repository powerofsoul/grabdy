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
      sync_cursor JSONB,
      last_synced_at TIMESTAMPTZ,
      sync_enabled BOOLEAN NOT NULL DEFAULT true,
      sync_interval_minutes INTEGER NOT NULL DEFAULT 60,
      config JSONB NOT NULL DEFAULT '{}',
      webhook_id TEXT,
      webhook_secret TEXT,
      org_id UUID NOT NULL REFERENCES org.orgs(id),
      created_by_id UUID NOT NULL REFERENCES auth.users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(org_id, provider),
      CONSTRAINT chk_connections_entity_type CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.Connection)}),
      CONSTRAINT chk_connections_org CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id))
    );

    CREATE TABLE integration.sync_logs (
      id UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.SyncLog)}),
      connection_id UUID NOT NULL REFERENCES integration.connections(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'PENDING',
      trigger TEXT NOT NULL,
      items_synced INTEGER NOT NULL DEFAULT 0,
      items_failed INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      details JSONB,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      org_id UUID NOT NULL REFERENCES org.orgs(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT chk_sync_logs_entity_type CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.SyncLog)}),
      CONSTRAINT chk_sync_logs_org CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id)),
      CONSTRAINT chk_sync_logs_connection_org CHECK (extract_org_numeric_id(connection_id) = extract_org_numeric_id(org_id))
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
