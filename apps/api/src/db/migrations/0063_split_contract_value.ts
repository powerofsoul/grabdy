import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE data.contracts RENAME COLUMN total_value TO payable_value`.execute(db);
  await sql`ALTER TABLE data.contracts ADD COLUMN receivable_value NUMERIC`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE data.contracts DROP COLUMN receivable_value`.execute(db);
  await sql`ALTER TABLE data.contracts RENAME COLUMN payable_value TO total_value`.execute(db);
}
