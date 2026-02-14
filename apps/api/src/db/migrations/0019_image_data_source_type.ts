import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TYPE "DataSourceType" ADD VALUE IF NOT EXISTS 'IMAGE'`.execute(db);
  await sql`ALTER TABLE data.data_sources ADD COLUMN IF NOT EXISTS ai_tags TEXT[] DEFAULT NULL`.execute(db);
  await sql`ALTER TABLE data.data_sources ADD COLUMN IF NOT EXISTS ai_description TEXT DEFAULT NULL`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE data.data_sources DROP COLUMN IF EXISTS ai_description`.execute(db);
  await sql`ALTER TABLE data.data_sources DROP COLUMN IF EXISTS ai_tags`.execute(db);
  // PostgreSQL does not support removing enum values
}
