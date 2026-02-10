/**
 * Infrastructure migration: schemas, extensions, enums, and packed UUID functions.
 *
 * This MUST run before all other migrations. It creates the foundational
 * objects that every table depends on.
 *
 * ## Schemas
 * - auth      — users, auth_tokens
 * - org       — orgs, org_memberships, org_invitations
 * - data      — collections, data_sources, chunks, chat_threads
 * - api       — api_keys, usage_logs
 *
 * ## Packed UUID System
 * Every entity ID is a 16-byte UUID with embedded metadata:
 *   Bytes 0-3:   org numeric ID (uint32, big-endian)
 *   Bytes 4-9:   timestamp (uint48, ms since epoch)
 *   Byte 10:     entity type code
 *   Bytes 11-15: crypto random
 */
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    -- ============================================================
    -- Schemas
    -- ============================================================
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS org;
    CREATE SCHEMA IF NOT EXISTS data;
    CREATE SCHEMA IF NOT EXISTS api;

    -- ============================================================
    -- Extensions (public schema)
    -- ============================================================
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE EXTENSION IF NOT EXISTS vector;

    -- ============================================================
    -- Enums (public schema — shared across all schemas)
    -- ============================================================
    CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');
    CREATE TYPE "TokenType" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFY');
    CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
    CREATE TYPE "DataSourceStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'READY', 'FAILED');
    CREATE TYPE "DataSourceType" AS ENUM ('PDF', 'CSV', 'DOCX', 'TXT', 'JSON');

    -- ============================================================
    -- Packed UUID functions (public schema)
    -- ============================================================

    -- Build a packed UUID: org(4B) + timestamp(6B) + entity_type(1B) + random(5B)
    CREATE OR REPLACE FUNCTION make_packed_uuid(
      org_num INT,
      entity_type INT,
      ts TIMESTAMPTZ DEFAULT now()
    ) RETURNS UUID LANGUAGE plpgsql AS $$
    DECLARE
      ms BIGINT := (EXTRACT(EPOCH FROM ts) * 1000)::BIGINT;
      raw BYTEA;
    BEGIN
      raw := set_byte(
        set_byte(
          set_byte(
            set_byte('\\x00000000'::bytea, 0, (org_num >> 24) & 255),
            1, (org_num >> 16) & 255),
          2, (org_num >> 8) & 255),
        3, org_num & 255);
      raw := raw
        || set_byte(
            set_byte(
              set_byte(
                set_byte(
                  set_byte(
                    set_byte('\\x000000000000'::bytea, 0, ((ms >> 40) & 255)::INT),
                    1, ((ms >> 32) & 255)::INT),
                  2, ((ms >> 24) & 255)::INT),
                3, ((ms >> 16) & 255)::INT),
              4, ((ms >> 8) & 255)::INT),
            5, (ms & 255)::INT);
      raw := raw || set_byte('\\x00'::bytea, 0, entity_type & 255);
      raw := raw || gen_random_bytes(5);
      RETURN encode(raw, 'hex')::UUID;
    END;
    $$;

    -- Extract the org numeric ID from bytes 0-3 of a packed UUID.
    CREATE OR REPLACE FUNCTION extract_org_numeric_id(id UUID) RETURNS INT
    LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
      SELECT (get_byte(decode(replace(id::text, '-', ''), 'hex'), 0) << 24)
           | (get_byte(decode(replace(id::text, '-', ''), 'hex'), 1) << 16)
           | (get_byte(decode(replace(id::text, '-', ''), 'hex'), 2) << 8)
           | (get_byte(decode(replace(id::text, '-', ''), 'hex'), 3));
    $$;

    -- Extract the entity type code from byte 10 of a packed UUID.
    CREATE OR REPLACE FUNCTION extract_entity_type(id UUID) RETURNS INT
    LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
      SELECT get_byte(decode(replace(id::text, '-', ''), 'hex'), 10);
    $$;

    -- Generate a random unique org numeric ID (positive int, avoiding 0 = GLOBAL_ORG).
    CREATE OR REPLACE FUNCTION generate_random_org_numeric_id() RETURNS INT
    LANGUAGE plpgsql AS $$
    DECLARE
      new_id INT;
    BEGIN
      LOOP
        new_id := floor(random() * 2147483646 + 1)::INT;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM org.orgs WHERE numeric_id = new_id);
      END LOOP;
      RETURN new_id;
    END;
    $$
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP FUNCTION IF EXISTS generate_random_org_numeric_id CASCADE;
    DROP FUNCTION IF EXISTS make_packed_uuid CASCADE;
    DROP FUNCTION IF EXISTS extract_org_numeric_id CASCADE;
    DROP FUNCTION IF EXISTS extract_entity_type CASCADE;

    DROP TYPE IF EXISTS "DataSourceType";
    DROP TYPE IF EXISTS "DataSourceStatus";
    DROP TYPE IF EXISTS "OrgRole";
    DROP TYPE IF EXISTS "TokenType";
    DROP TYPE IF EXISTS "UserStatus";

    DROP SCHEMA IF EXISTS api CASCADE;
    DROP SCHEMA IF EXISTS data CASCADE;
    DROP SCHEMA IF EXISTS org CASCADE;
    DROP SCHEMA IF EXISTS auth CASCADE
  `.execute(db);
}
