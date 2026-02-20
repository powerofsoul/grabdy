import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE analytics.ai_usage_logs
      DROP CONSTRAINT ai_usage_logs_request_type_check;
    ALTER TABLE analytics.ai_usage_logs
      ADD CONSTRAINT ai_usage_logs_request_type_check
      CHECK (request_type IN ('CHAT', 'EMBEDDING', 'RERANK'));
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE analytics.ai_usage_logs
      DROP CONSTRAINT ai_usage_logs_request_type_check;
    ALTER TABLE analytics.ai_usage_logs
      ADD CONSTRAINT ai_usage_logs_request_type_check
      CHECK (request_type IN ('CHAT', 'EMBEDDING'));
  `.execute(db);
}
