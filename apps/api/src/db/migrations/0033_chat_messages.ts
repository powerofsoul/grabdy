import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE SCHEMA IF NOT EXISTS agent;
    CREATE TABLE agent.chat_messages (
      id          UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.ChatMessage)}),
      thread_id   UUID NOT NULL REFERENCES data.chat_threads(id) ON DELETE CASCADE,
      org_id      UUID NOT NULL REFERENCES org.orgs(id),
      role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
      content     TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- ID constraints
    ALTER TABLE agent.chat_messages ADD CONSTRAINT chk_chat_messages_entity_type
      CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.ChatMessage)});
    ALTER TABLE agent.chat_messages ADD CONSTRAINT chk_chat_messages_org
      CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id));

    -- FK org constraint
    ALTER TABLE agent.chat_messages ADD CONSTRAINT chk_chat_messages_thread_org
      CHECK (extract_org_numeric_id(thread_id) = extract_org_numeric_id(org_id));

    CREATE INDEX idx_chat_messages_thread ON agent.chat_messages (thread_id, created_at ASC);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS agent.chat_messages`.execute(db);
}
