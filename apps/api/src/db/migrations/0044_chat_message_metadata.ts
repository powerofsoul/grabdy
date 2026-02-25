import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE agent.chat_messages
      ADD COLUMN metadata JSONB,
      ADD COLUMN duration_ms INTEGER;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE agent.chat_messages
      DROP COLUMN IF EXISTS metadata,
      DROP COLUMN IF EXISTS duration_ms;
  `.execute(db);
}
