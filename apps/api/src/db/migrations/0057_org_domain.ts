import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE org.orgs ADD COLUMN domain TEXT;

    -- Backfill domain from the OWNER's email for each org.
    -- When multiple orgs share a domain, only the oldest org gets it (MIN(o.id)).
    UPDATE org.orgs
    SET domain = sub.domain
    FROM (
      SELECT DISTINCT ON (split_part(u.email, '@', 2))
        o.id AS org_id,
        split_part(u.email, '@', 2) AS domain
      FROM org.orgs o
      JOIN org.org_memberships m ON m.org_id = o.id AND 'OWNER' = ANY(m.roles)
      JOIN auth.users u ON u.id = m.user_id
      WHERE u.email LIKE '%@%'
      ORDER BY split_part(u.email, '@', 2), o.created_at ASC
    ) sub
    WHERE org.orgs.id = sub.org_id;

    CREATE UNIQUE INDEX idx_orgs_domain ON org.orgs (domain) WHERE domain IS NOT NULL;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP INDEX IF EXISTS org.idx_orgs_domain;
    ALTER TABLE org.orgs DROP COLUMN domain;
  `.execute(db);
}
