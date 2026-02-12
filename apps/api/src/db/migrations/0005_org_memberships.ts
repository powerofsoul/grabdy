import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE org.org_memberships (
      id UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.OrgMembership)}),
      roles "OrgRole"[] NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      org_id UUID NOT NULL REFERENCES org.orgs(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX org_memberships_org_id_user_id_key ON org.org_memberships (org_id, user_id);
    CREATE INDEX org_memberships_user_id_idx ON org.org_memberships (user_id);
    ALTER TABLE org.org_memberships ADD CONSTRAINT chk_org_memberships_entity_type CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.OrgMembership)});
    ALTER TABLE org.org_memberships ADD CONSTRAINT chk_org_memberships_org CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id));
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS org.org_memberships CASCADE`.execute(db);
}
