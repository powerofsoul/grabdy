import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE data.extracted_images (
      id UUID PRIMARY KEY,
      data_source_id UUID NOT NULL REFERENCES data.data_sources(id) ON DELETE CASCADE,
      storage_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      page_number INT,
      ai_description TEXT,
      org_id UUID NOT NULL REFERENCES org.orgs(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`CREATE INDEX ON data.extracted_images (data_source_id)`.execute(db);
  await sql`CREATE INDEX ON data.extracted_images (org_id)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS data.extracted_images`.execute(db);
}
