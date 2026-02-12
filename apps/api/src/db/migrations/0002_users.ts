import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE auth.users (
      id UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.User)}),
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT,
      email_verified BOOLEAN NOT NULL DEFAULT false,
      status "UserStatus" NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX users_email_key ON auth.users (email);
    ALTER TABLE auth.users ADD CONSTRAINT chk_users_entity_type CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.User)});
    ALTER TABLE auth.users ADD CONSTRAINT chk_users_org CHECK (extract_org_numeric_id(id) = 0);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS auth.users CASCADE`.execute(db);
}
