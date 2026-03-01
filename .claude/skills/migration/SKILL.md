---
name: migration
description: Generate a Kysely database migration and update db.ts schema mirror. Use when user says "create migration", "add column", "new table", "schema change", "add index", or "alter table".
disable-model-invocation: false
argument-hint: '[what to change]'
---

# Database Migration Generator

## Step 1: Understand the change

From `$ARGUMENTS`, determine:

- New table, new column, index, constraint, or ALTER
- Which schema (auth, org, data, api, integration, analytics)
- Entity type code if creating a new table (check ENTITY_TYPE_MAP in `packages/common/src/id.ts`)

## Step 2: Read current state

- Read `apps/api/src/db/db.ts` to understand existing schema
- List `apps/api/src/db/migrations/` to find the next sequence number
- If adding to an existing table, read the original migration to understand constraints

## Step 3: Create migration file

File: `apps/api/src/db/migrations/NNNN_description.ts`

Naming: next sequential number (e.g., if last is `0055_`, use `0056_`), lowercase with underscores.

```typescript
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    -- SQL statements here
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    -- Reverse the changes
  `.execute(db);
}
```

For new tables with packed UUIDs:

```typescript
import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE schema.table_name (
      id UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.EntityType)}),
      org_id UUID NOT NULL REFERENCES org.orgs(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX table_name_org_id_idx ON schema.table_name (org_id);

    ALTER TABLE schema.table_name
      ADD CONSTRAINT chk_table_name_entity_type
      CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.EntityType)});

    ALTER TABLE schema.table_name
      ADD CONSTRAINT chk_table_name_org
      CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id));
  `.execute(db);
}
```

## Step 4: Update db.ts

Add or modify the table interface in `apps/api/src/db/db.ts`:

- Use `Generated<T>` for columns with DB defaults (id, created_at, status with defaults)
- Use `DbId<'EntityType'>` for ID columns
- Use `Timestamp` for date columns
- Use inline discriminated unions for JSONB (never `unknown`)
- Use snake_case matching actual DB column names

## Rules

- NEVER modify existing migration files
- Always provide both `up()` and `down()` functions
- Use `sql` template literals, not Kysely schema builder for DDL
- Use snake_case for all PostgreSQL names
- Add indexes for foreign keys and commonly queried columns
- Add CHECK constraints for entity type and org scoping on new tables
- Import `ENTITY_TYPE_MAP` from `@grabdy/common` when creating tables with packed UUIDs
