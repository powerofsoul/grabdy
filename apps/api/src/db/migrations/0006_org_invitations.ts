import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE org.org_invitations (
      id UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.OrgInvitation)}),
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      roles "OrgRole"[] NOT NULL,
      token TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      org_id UUID NOT NULL REFERENCES org.orgs(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX org_invitations_org_id_email_key ON org.org_invitations (org_id, email);
    CREATE UNIQUE INDEX org_invitations_token_key ON org.org_invitations (token);

    ALTER TABLE org.org_invitations ADD CONSTRAINT chk_org_invitations_entity_type CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.OrgInvitation)});
    ALTER TABLE org.org_invitations ADD CONSTRAINT chk_org_invitations_org CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id));
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS org.org_invitations CASCADE`.execute(db);
}
