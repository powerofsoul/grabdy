import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TYPE "DataSourceType" ADD VALUE IF NOT EXISTS 'CODE_REPO'
  `.execute(db);

  await sql`
    CREATE TABLE data.code_repo_state (
      data_source_id UUID PRIMARY KEY REFERENCES data.data_sources(id) ON DELETE CASCADE,
      repo_full_name TEXT NOT NULL,
      branch TEXT NOT NULL DEFAULT 'main',
      last_commit_sha TEXT,
      total_files INT NOT NULL DEFAULT 0,
      processed_files INT NOT NULL DEFAULT 0,
      efs_path TEXT,
      org_id UUID NOT NULL REFERENCES org.orgs(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT chk_code_repo_state_org
        CHECK (extract_org_numeric_id(data_source_id) = extract_org_numeric_id(org_id))
    );
    CREATE INDEX ON data.code_repo_state (org_id);
  `.execute(db);

  await sql`
    CREATE TABLE data.code_repo_docs (
      id UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.CodeRepoDoc)}),
      data_source_id UUID NOT NULL REFERENCES data.data_sources(id) ON DELETE CASCADE,
      commit_sha TEXT NOT NULL,
      content TEXT NOT NULL,
      version INT NOT NULL,
      org_id UUID NOT NULL REFERENCES org.orgs(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (data_source_id, version),
      CONSTRAINT chk_code_repo_docs_entity_type
        CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.CodeRepoDoc)}),
      CONSTRAINT chk_code_repo_docs_org
        CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id)),
      CONSTRAINT chk_code_repo_docs_data_source_org
        CHECK (extract_org_numeric_id(data_source_id) = extract_org_numeric_id(org_id))
    );
    CREATE INDEX ON data.code_repo_docs (data_source_id);
    CREATE INDEX ON data.code_repo_docs (org_id);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS data.code_repo_docs;
    DROP TABLE IF EXISTS data.code_repo_state;
  `.execute(db);
}
