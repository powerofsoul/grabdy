import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE UNIQUE INDEX uq_code_repo_state_repo_org
      ON data.code_repo_state (repo_full_name, org_id);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS data.uq_code_repo_state_repo_org;
  `.execute(db);
}
