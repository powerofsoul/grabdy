import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE data.shared_chats (
      id UUID PRIMARY KEY,
      thread_id UUID NOT NULL REFERENCES data.chat_threads(id) ON DELETE CASCADE,
      org_id UUID NOT NULL REFERENCES org.orgs(id) ON DELETE CASCADE,
      membership_id UUID NOT NULL REFERENCES org.org_memberships(id),
      title TEXT,
      messages_snapshot JSONB NOT NULL,
      canvas_state_snapshot JSONB,
      share_token TEXT NOT NULL UNIQUE,
      is_public BOOLEAN NOT NULL DEFAULT false,
      revoked BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX shared_chats_share_token_idx ON data.shared_chats (share_token) WHERE NOT revoked;
    CREATE INDEX shared_chats_thread_id_idx ON data.shared_chats (thread_id);
    CREATE INDEX shared_chats_org_id_idx ON data.shared_chats (org_id);

    ALTER TABLE data.shared_chats ADD CONSTRAINT chk_shared_chats_entity_type
      CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.SharedChat)});
    ALTER TABLE data.shared_chats ADD CONSTRAINT chk_shared_chats_org
      CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id));
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS data.shared_chats CASCADE`.execute(db);
}
