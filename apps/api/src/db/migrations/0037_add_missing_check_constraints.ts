import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Add entity type CHECK constraints missing from 0035 and 0036
  await sql`
    ALTER TABLE data.code_repo_doc_pages
      ADD CONSTRAINT chk_doc_pages_entity_type
        CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.DocPage)});

    ALTER TABLE data.code_repo_doc_pages
      ADD CONSTRAINT chk_doc_pages_data_source_org
        CHECK (extract_org_numeric_id(data_source_id) = extract_org_numeric_id(org_id));

    ALTER TABLE data.code_repo_doc_pages
      ADD CONSTRAINT chk_doc_pages_parent_org
        CHECK (parent_id IS NULL OR extract_org_numeric_id(parent_id) = extract_org_numeric_id(org_id));

    ALTER TABLE data.code_repo_doc_page_versions
      ADD CONSTRAINT chk_doc_page_versions_entity_type
        CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.DocPageVersion)});

    ALTER TABLE data.code_repo_doc_page_versions
      ADD CONSTRAINT chk_doc_page_versions_page_org
        CHECK (extract_org_numeric_id(page_id) = extract_org_numeric_id(org_id));
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE data.code_repo_doc_pages DROP CONSTRAINT IF EXISTS chk_doc_pages_entity_type;
    ALTER TABLE data.code_repo_doc_pages DROP CONSTRAINT IF EXISTS chk_doc_pages_data_source_org;
    ALTER TABLE data.code_repo_doc_pages DROP CONSTRAINT IF EXISTS chk_doc_pages_parent_org;
    ALTER TABLE data.code_repo_doc_page_versions DROP CONSTRAINT IF EXISTS chk_doc_page_versions_entity_type;
    ALTER TABLE data.code_repo_doc_page_versions DROP CONSTRAINT IF EXISTS chk_doc_page_versions_page_org;
  `.execute(db);
}
