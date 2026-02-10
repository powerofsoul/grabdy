import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE data.chat_threads (
      id UUID PRIMARY KEY DEFAULT make_packed_uuid(0, 48),
      title TEXT,
      collection_id UUID REFERENCES data.collections(id) ON DELETE SET NULL,
      org_id UUID NOT NULL REFERENCES org.orgs(id) ON DELETE CASCADE,
      membership_id UUID NOT NULL REFERENCES org.org_memberships(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX chat_threads_org_id_idx ON data.chat_threads (org_id);
    CREATE INDEX chat_threads_membership_id_idx ON data.chat_threads (membership_id);
    ALTER TABLE data.chat_threads ADD CONSTRAINT chk_chat_threads_entity_type CHECK (extract_entity_type(id) = 48);
    ALTER TABLE data.chat_threads ADD CONSTRAINT chk_chat_threads_org CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id));
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS data.chat_threads CASCADE`.execute(db);
}
