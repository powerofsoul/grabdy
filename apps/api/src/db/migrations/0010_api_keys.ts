import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE api.api_keys (
      id UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.ApiKey)}),
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      org_id UUID NOT NULL REFERENCES org.orgs(id) ON DELETE CASCADE,
      created_by_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      last_used_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX api_keys_org_id_idx ON api.api_keys (org_id);
    CREATE INDEX api_keys_key_prefix_idx ON api.api_keys (key_prefix);
    ALTER TABLE api.api_keys ADD CONSTRAINT chk_api_keys_entity_type CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.ApiKey)});
    ALTER TABLE api.api_keys ADD CONSTRAINT chk_api_keys_org CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id));
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS api.api_keys CASCADE`.execute(db);
}
