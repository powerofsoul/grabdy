import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE data.code_repo_doc_page_versions (
      id UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.DocPageVersion)}),
      page_id UUID NOT NULL REFERENCES data.code_repo_doc_pages(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      commit_sha TEXT,
      source TEXT NOT NULL CHECK (source IN ('AI', 'USER')),
      version INT NOT NULL,
      org_id UUID NOT NULL REFERENCES org.orgs(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (page_id, version),
      CONSTRAINT chk_doc_page_versions_org
        CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id))
    );
    CREATE INDEX ON data.code_repo_doc_page_versions (page_id, version);
    CREATE INDEX ON data.code_repo_doc_page_versions (org_id);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS data.code_repo_doc_page_versions;
  `.execute(db);
}
