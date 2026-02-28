import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TYPE "DataSourceStatus" ADD VALUE 'DELETING'`.execute(db);
}

export async function down(): Promise<void> {
  // PostgreSQL does not support removing enum values
}
