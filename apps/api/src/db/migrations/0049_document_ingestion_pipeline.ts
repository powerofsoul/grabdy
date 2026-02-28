import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Add new columns to data_sources
  await sql`
    ALTER TABLE data.data_sources
      ADD COLUMN parent_data_source_id UUID REFERENCES data.data_sources(id) ON DELETE CASCADE,
      ADD COLUMN classification JSONB
  `.execute(db);

  await sql`CREATE INDEX data_sources_parent_id_idx ON data.data_sources (parent_data_source_id)`.execute(
    db
  );

  // Add new columns to chunks
  await sql`
    ALTER TABLE data.chunks
      ADD COLUMN embedding_context TEXT,
      ADD COLUMN extracted_image_id UUID
  `.execute(db);

  // Re-create extracted_images table
  await sql`
    CREATE TABLE data.extracted_images (
      id UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.ExtractedImage)}),
      data_source_id UUID NOT NULL REFERENCES data.data_sources(id) ON DELETE CASCADE,
      storage_path TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      page_number INT,
      ai_description TEXT,
      width INT,
      height INT,
      file_size INT,
      org_id UUID NOT NULL REFERENCES org.orgs(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT chk_extracted_images_org CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id)),
      CONSTRAINT chk_extracted_images_entity_type CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.ExtractedImage)}),
      CONSTRAINT chk_extracted_images_data_source_org CHECK (extract_org_numeric_id(data_source_id) = extract_org_numeric_id(org_id))
    )
  `.execute(db);

  await sql`CREATE INDEX extracted_images_data_source_idx ON data.extracted_images (data_source_id)`.execute(
    db
  );
  await sql`CREATE INDEX extracted_images_org_idx ON data.extracted_images (org_id)`.execute(db);

  // Add FK from chunks to extracted_images
  await sql`
    ALTER TABLE data.chunks
      ADD CONSTRAINT chunks_extracted_image_id_fkey
      FOREIGN KEY (extracted_image_id) REFERENCES data.extracted_images(id) ON DELETE SET NULL
  `.execute(db);

  await sql`CREATE INDEX chunks_extracted_image_idx ON data.chunks (extracted_image_id)`.execute(
    db
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS data.chunks_extracted_image_idx`.execute(db);
  await sql`ALTER TABLE data.chunks DROP CONSTRAINT IF EXISTS chunks_extracted_image_id_fkey`.execute(
    db
  );

  await sql`DROP TABLE IF EXISTS data.extracted_images`.execute(db);

  await sql`
    ALTER TABLE data.chunks
      DROP COLUMN IF EXISTS embedding_context,
      DROP COLUMN IF EXISTS extracted_image_id
  `.execute(db);

  await sql`DROP INDEX IF EXISTS data.data_sources_parent_id_idx`.execute(db);
  await sql`
    ALTER TABLE data.data_sources
      DROP COLUMN IF EXISTS parent_data_source_id,
      DROP COLUMN IF EXISTS classification
  `.execute(db);
}
