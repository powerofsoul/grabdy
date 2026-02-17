import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE auth.users ADD COLUMN google_id TEXT;
    CREATE UNIQUE INDEX users_google_id_key ON auth.users (google_id) WHERE google_id IS NOT NULL;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS auth.users_google_id_key;
    ALTER TABLE auth.users DROP COLUMN IF EXISTS google_id;
  `.execute(db);
}
