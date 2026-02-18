import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    -- Add first_name and last_name with defaults so existing rows get ''
    ALTER TABLE auth.users ADD COLUMN first_name TEXT NOT NULL DEFAULT '';
    ALTER TABLE auth.users ADD COLUMN last_name TEXT NOT NULL DEFAULT '';

    -- Backfill from existing name column
    UPDATE auth.users
    SET first_name = split_part(name, ' ', 1),
        last_name  = CASE
          WHEN position(' ' IN name) > 0
          THEN substring(name FROM position(' ' IN name) + 1)
          ELSE ''
        END;

    -- Drop the defaults (they were only for the migration)
    ALTER TABLE auth.users ALTER COLUMN first_name DROP DEFAULT;
    ALTER TABLE auth.users ALTER COLUMN last_name DROP DEFAULT;

    -- Drop the old name column
    ALTER TABLE auth.users DROP COLUMN name;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE auth.users ADD COLUMN name TEXT NOT NULL DEFAULT '';
    UPDATE auth.users SET name = TRIM(first_name || ' ' || last_name);
    ALTER TABLE auth.users ALTER COLUMN name DROP DEFAULT;
    ALTER TABLE auth.users DROP COLUMN first_name;
    ALTER TABLE auth.users DROP COLUMN last_name;
  `.execute(db);
}
