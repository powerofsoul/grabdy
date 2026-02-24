import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE data.chunks ADD COLUMN source_key TEXT`.execute(db);

  // Make source_url nullable (external sources keep it, uploaded files use source_key)
  await sql`ALTER TABLE data.chunks ALTER COLUMN source_url DROP NOT NULL`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE data.chunks DROP COLUMN source_key`.execute(db);
  await sql`ALTER TABLE data.chunks ALTER COLUMN source_url SET NOT NULL`.execute(db);
}
