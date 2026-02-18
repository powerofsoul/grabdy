import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE org.org_invitations DROP COLUMN name;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE org.org_invitations ADD COLUMN name TEXT NOT NULL DEFAULT '';
  `.execute(db);
}
