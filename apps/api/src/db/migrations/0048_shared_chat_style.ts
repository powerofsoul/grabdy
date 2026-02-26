import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE data.shared_chats ADD COLUMN accent_color TEXT, ADD COLUMN primary_color TEXT;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE data.shared_chats DROP COLUMN accent_color;
    ALTER TABLE data.shared_chats DROP COLUMN primary_color;
  `.execute(db);
}
