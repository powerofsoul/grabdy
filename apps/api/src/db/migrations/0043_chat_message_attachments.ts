import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE agent.chat_messages
      ADD COLUMN attachments JSONB;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE agent.chat_messages
      DROP COLUMN attachments;
  `.execute(db);
}
