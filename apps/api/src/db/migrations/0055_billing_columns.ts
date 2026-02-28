import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE org.orgs
      ADD COLUMN stripe_customer_id TEXT UNIQUE
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE org.orgs
      DROP COLUMN stripe_customer_id
  `.execute(db);
}
