import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE data.data_sources (
      id UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.DataSource)}),
      title TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INT NOT NULL,
      storage_path TEXT NOT NULL,
      type "DataSourceType" NOT NULL,
      status "DataSourceStatus" NOT NULL DEFAULT 'UPLOADED',
      summary TEXT,
      page_count INT,
      source_url TEXT NOT NULL,
      collection_id UUID REFERENCES data.collections(id) ON DELETE SET NULL,
      connection_id UUID,
      external_id TEXT,
      org_id UUID NOT NULL REFERENCES org.orgs(id) ON DELETE CASCADE,
      uploaded_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX data_sources_org_id_idx ON data.data_sources (org_id);
    CREATE INDEX data_sources_collection_id_idx ON data.data_sources (collection_id);
    ALTER TABLE data.data_sources ADD CONSTRAINT chk_data_sources_entity_type CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.DataSource)});
    ALTER TABLE data.data_sources ADD CONSTRAINT chk_data_sources_org CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id));
    ALTER TABLE data.data_sources ADD CONSTRAINT chk_data_sources_collection_org CHECK (collection_id IS NULL OR extract_org_numeric_id(collection_id) = extract_org_numeric_id(org_id));
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS data.data_sources CASCADE`.execute(db);
}
