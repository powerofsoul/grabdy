import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE data.code_repo_doc_pages (
      id UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.DocPage)}),
      data_source_id UUID NOT NULL REFERENCES data.data_sources(id) ON DELETE CASCADE,
      parent_id UUID REFERENCES data.code_repo_doc_pages(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      sort_order INT NOT NULL DEFAULT 0,
      is_user_edited BOOLEAN NOT NULL DEFAULT false,
      commit_sha TEXT,
      version INT NOT NULL DEFAULT 1,
      org_id UUID NOT NULL REFERENCES org.orgs(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (data_source_id, slug),
      CONSTRAINT chk_doc_pages_org
        CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id))
    );
    CREATE INDEX ON data.code_repo_doc_pages (data_source_id, parent_id, sort_order);
    CREATE INDEX ON data.code_repo_doc_pages (org_id);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS data.code_repo_doc_pages;
  `.execute(db);
}
