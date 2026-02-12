import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE data.chunks (
      id UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.Chunk)}),
      content TEXT NOT NULL,
      chunk_index INT NOT NULL,
      metadata JSONB,
      embedding vector(1536),
      data_source_id UUID NOT NULL REFERENCES data.data_sources(id) ON DELETE CASCADE,
      collection_id UUID REFERENCES data.collections(id) ON DELETE SET NULL,
      org_id UUID NOT NULL REFERENCES org.orgs(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX chunks_org_id_idx ON data.chunks (org_id);
    CREATE INDEX chunks_data_source_id_idx ON data.chunks (data_source_id);
    CREATE INDEX chunks_collection_id_idx ON data.chunks (collection_id);
    CREATE INDEX chunks_embedding_idx ON data.chunks USING hnsw (embedding vector_cosine_ops);
    ALTER TABLE data.chunks ADD CONSTRAINT chk_chunks_entity_type CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.Chunk)});
    ALTER TABLE data.chunks ADD CONSTRAINT chk_chunks_org CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id));
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS data.chunks CASCADE`.execute(db);
}
