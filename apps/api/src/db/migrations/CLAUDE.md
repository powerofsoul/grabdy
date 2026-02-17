# Migration Conventions

## Packed UUID IDs

Every table MUST use packed UUIDs for its `id` column. Never use `gen_random_uuid()`.

### Required for every table

1. **Default**: `DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.<EntityName>)})`
2. **Entity type constraint**: `CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.<EntityName>)})`
3. **Org constraint on `id`**: `CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id))`
   - For global tables (users, auth_tokens): `CHECK (extract_org_numeric_id(id) = 0)`

## Foreign Key Org Consistency — CRITICAL

Every FK column that references an org-scoped table MUST have a CHECK constraint ensuring the org embedded in the FK matches `org_id`. This prevents cross-org data leaks at the DB level.

### Required for every org-scoped FK

- **Non-nullable FK**: `CHECK (extract_org_numeric_id(fk_column) = extract_org_numeric_id(org_id))`
- **Nullable FK**: `CHECK (fk_column IS NULL OR extract_org_numeric_id(fk_column) = extract_org_numeric_id(org_id))`

FKs to global tables (users, auth_tokens) do NOT need org checks.

### Naming convention

`chk_<table>_<fk_column_without_id_suffix>_org`

Examples:
- `chk_chunks_data_source_org` for `data_source_id` on chunks
- `chk_chat_threads_collection_org` for `collection_id` on chat_threads
- `chk_usage_logs_api_key_org` for `api_key_id` on usage_logs

### Template

```ts
import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE schema.table_name (
      id UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.EntityName)}),
      parent_id UUID NOT NULL REFERENCES schema.parents(id),
      optional_ref_id UUID REFERENCES schema.refs(id),
      org_id UUID NOT NULL REFERENCES org.orgs(id)
    );

    -- ID constraints
    ALTER TABLE schema.table_name ADD CONSTRAINT chk_table_name_entity_type CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.EntityName)});
    ALTER TABLE schema.table_name ADD CONSTRAINT chk_table_name_org CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id));

    -- FK org constraints (every org-scoped FK gets one)
    ALTER TABLE schema.table_name ADD CONSTRAINT chk_table_name_parent_org CHECK (extract_org_numeric_id(parent_id) = extract_org_numeric_id(org_id));
    ALTER TABLE schema.table_name ADD CONSTRAINT chk_table_name_optional_ref_org CHECK (optional_ref_id IS NULL OR extract_org_numeric_id(optional_ref_id) = extract_org_numeric_id(org_id));
  `.execute(db);
}
```

## Entity types and DB types

Entity type names (`TableIdName`) and their byte codes (`ENTITY_TYPE_MAP`) are defined in **`packages/common/src/id.ts`**. Always refer to that file for the current list — it is the source of truth and will evolve as new tables are added.

Kysely table interfaces (column types for each table) are defined in **`apps/api/src/db/db.ts`**. Always refer to that file for column names, types, and nullability.

## `db.ts` is the source of truth — CRITICAL

`apps/api/src/db/db.ts` is the **authoritative representation of the database schema**. It MUST NOT import from `@grabdy/contracts`, `@grabdy/common` (except `DbId`, `OrgNumericId`), or any application module. All enum types, JSONB column types, and table interfaces are defined locally in `db.ts`.

- The **only export** from `db.ts` is the `DB` interface. All helper types, enums, and JSONB types are file-private
- JSONB columns use opaque types (e.g., `Record<string, unknown>`) — they represent what the DB actually stores
- Consumers that need rich typed access to JSONB data MUST parse it at the boundary using Zod schemas from `@grabdy/contracts`
- If a type error occurs because db.ts types are "too loose", the fix is in the consumer (parse/validate), NOT in db.ts

## General rules

- Use snake_case for all table and column names
- Always include `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- Import `ENTITY_TYPE_MAP` from `@grabdy/common` — never hardcode byte values
