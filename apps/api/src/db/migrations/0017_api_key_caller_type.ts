import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE analytics.ai_usage_logs
      DROP CONSTRAINT ai_usage_logs_caller_type_check;

    ALTER TABLE analytics.ai_usage_logs
      ADD CONSTRAINT ai_usage_logs_caller_type_check
      CHECK (caller_type IN ('MEMBER', 'SYSTEM', 'API_KEY'));
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE analytics.ai_usage_logs
      DROP CONSTRAINT ai_usage_logs_caller_type_check;

    ALTER TABLE analytics.ai_usage_logs
      ADD CONSTRAINT ai_usage_logs_caller_type_check
      CHECK (caller_type IN ('MEMBER', 'SYSTEM'));
  `.execute(db);
}
