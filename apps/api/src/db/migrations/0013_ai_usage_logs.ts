import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE SCHEMA IF NOT EXISTS analytics;

    CREATE TABLE analytics.ai_usage_logs (
      id UUID PRIMARY KEY DEFAULT make_packed_uuid(0, 64),
      model TEXT NOT NULL,
      provider TEXT NOT NULL,
      caller_type TEXT NOT NULL CHECK (caller_type IN ('MEMBER', 'SYSTEM')),
      request_type TEXT NOT NULL CHECK (request_type IN ('CHAT', 'EMBEDDING')),
      input_tokens INT NOT NULL DEFAULT 0,
      output_tokens INT NOT NULL DEFAULT 0,
      total_tokens INT NOT NULL DEFAULT 0,
      cost NUMERIC(12,8) NOT NULL DEFAULT 0,
      duration_ms INT,
      finish_reason TEXT,
      streaming BOOLEAN NOT NULL DEFAULT false,
      org_id UUID NOT NULL REFERENCES org.orgs(id) ON DELETE CASCADE,
      user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX ai_usage_logs_org_id_created_at_idx ON analytics.ai_usage_logs (org_id, created_at);
    CREATE INDEX ai_usage_logs_org_id_model_idx ON analytics.ai_usage_logs (org_id, model);
    CREATE INDEX ai_usage_logs_org_id_request_type_idx ON analytics.ai_usage_logs (org_id, request_type);

    ALTER TABLE analytics.ai_usage_logs ADD CONSTRAINT chk_ai_usage_logs_entity_type CHECK (extract_entity_type(id) = 64);
    ALTER TABLE analytics.ai_usage_logs ADD CONSTRAINT chk_ai_usage_logs_org CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id));

    CREATE OR REPLACE FUNCTION ai_usage_logs_append_only()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'ai_usage_logs is append-only: UPDATE not allowed';
      ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'ai_usage_logs is append-only: DELETE not allowed';
      END IF;
      RETURN NULL;
    END;
    $$;
    CREATE TRIGGER trg_ai_usage_logs_append_only
      BEFORE UPDATE OR DELETE ON analytics.ai_usage_logs
      FOR EACH ROW EXECUTE FUNCTION ai_usage_logs_append_only();
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS analytics.ai_usage_logs CASCADE;
    DROP FUNCTION IF EXISTS ai_usage_logs_append_only CASCADE;
    DROP SCHEMA IF EXISTS analytics CASCADE;
  `.execute(db);
}
