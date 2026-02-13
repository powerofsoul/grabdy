import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE data.connections (
      id UUID PRIMARY KEY,
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
      UNIQUE(org_id, provider)
    );

    CREATE TABLE data.sync_logs (
      id UUID PRIMARY KEY,
      connection_id UUID NOT NULL REFERENCES data.connections(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'PENDING',
      trigger TEXT NOT NULL,
      items_synced INTEGER NOT NULL DEFAULT 0,
      items_failed INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      org_id UUID NOT NULL REFERENCES org.orgs(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS data.sync_logs;
    DROP TABLE IF EXISTS data.connections;
  `.execute(db);
}
