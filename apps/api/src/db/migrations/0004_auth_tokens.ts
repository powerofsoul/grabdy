import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE auth.auth_tokens (
      id UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.AuthToken)}),
      token TEXT NOT NULL,
      type "TokenType" NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX auth_tokens_token_key ON auth.auth_tokens (token);
    CREATE INDEX auth_tokens_user_id_idx ON auth.auth_tokens (user_id);
    ALTER TABLE auth.auth_tokens ADD CONSTRAINT chk_auth_tokens_entity_type CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.AuthToken)});
    ALTER TABLE auth.auth_tokens ADD CONSTRAINT chk_auth_tokens_org CHECK (extract_org_numeric_id(id) = 0);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS auth.auth_tokens CASCADE`.execute(db);
}
