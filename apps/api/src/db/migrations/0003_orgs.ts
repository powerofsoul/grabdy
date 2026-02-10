import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE org.orgs (
      id UUID PRIMARY KEY DEFAULT make_packed_uuid(0, 1),
      name TEXT NOT NULL,
      numeric_id INT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE org.orgs ADD CONSTRAINT chk_orgs_entity_type CHECK (extract_entity_type(id) = 1);
    ALTER TABLE org.orgs ADD CONSTRAINT chk_orgs_org CHECK (extract_org_numeric_id(id) = numeric_id);

    -- BEFORE INSERT trigger: generates a random numeric_id and a packed UUID
    -- that embeds it. Services omit both id and numeric_id from inserts.
    CREATE OR REPLACE FUNCTION org_before_insert() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      NEW.numeric_id := generate_random_org_numeric_id();
      NEW.id := make_packed_uuid(NEW.numeric_id, 1);
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER trg_orgs_before_insert
      BEFORE INSERT ON org.orgs
      FOR EACH ROW EXECUTE FUNCTION org_before_insert();
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TRIGGER IF EXISTS trg_orgs_before_insert ON org.orgs;
    DROP FUNCTION IF EXISTS org_before_insert CASCADE;
    DROP TABLE IF EXISTS org.orgs CASCADE
  `.execute(db);
}
