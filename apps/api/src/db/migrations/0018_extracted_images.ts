import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE data.extracted_images (
      id UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.ExtractedImage)}),
      data_source_id UUID NOT NULL REFERENCES data.data_sources(id) ON DELETE CASCADE,
      storage_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      page_number INT,
      ai_description TEXT,
      org_id UUID NOT NULL REFERENCES org.orgs(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT chk_extracted_images_org CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id)),
      CONSTRAINT chk_extracted_images_entity_type CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.ExtractedImage)}),
      CONSTRAINT chk_extracted_images_data_source_org CHECK (extract_org_numeric_id(data_source_id) = extract_org_numeric_id(org_id))
    )
  `.execute(db);

  await sql`CREATE INDEX ON data.extracted_images (data_source_id)`.execute(db);
  await sql`CREATE INDEX ON data.extracted_images (org_id)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS data.extracted_images`.execute(db);
}
