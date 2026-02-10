import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE api.usage_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      api_key_id UUID NOT NULL REFERENCES api.api_keys(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      input_tokens INT NOT NULL DEFAULT 0,
      output_tokens INT NOT NULL DEFAULT 0,
      org_id UUID NOT NULL REFERENCES org.orgs(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX usage_logs_org_id_created_at_idx ON api.usage_logs (org_id, created_at);
    CREATE INDEX usage_logs_api_key_id_idx ON api.usage_logs (api_key_id);

    CREATE OR REPLACE FUNCTION usage_logs_append_only()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'usage_logs is append-only: UPDATE not allowed';
      ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'usage_logs is append-only: DELETE not allowed';
      END IF;
      RETURN NULL;
    END;
    $$;
    CREATE TRIGGER trg_usage_logs_append_only
      BEFORE UPDATE OR DELETE ON api.usage_logs
      FOR EACH ROW EXECUTE FUNCTION usage_logs_append_only();
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS api.usage_logs CASCADE;
    DROP FUNCTION IF EXISTS usage_logs_append_only CASCADE
  `.execute(db);
}
