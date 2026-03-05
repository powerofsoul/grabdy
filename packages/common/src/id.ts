import type { Tagged } from './branded.js';
import z from 'zod';

// ── TableIdName ──────────────────────────────────────────────────────────

/**
 * PascalCase model names for branded database IDs.
 * Each maps to a PostgreSQL table (plural/snake_case via @@map()).
 */
export type TableIdName =
  | 'Org'
  | 'User'
  | 'OrgMembership'
  | 'AuthToken'
  | 'OrgInvitation'
  | 'Collection'
  | 'DataSource'
  | 'Chunk'
  | 'ExtractedImage'
  | 'Contract'
  | 'ApiKey'
  | 'UsageLog'
  | 'ChatThread'
  | 'AiUsageLog'
  | 'SharedChat'
  | 'Connection'
  | 'ChatMessage'
  | 'Bot'
  | 'BotSigningKey';

// ── Entity Type Maps ─────────────────────────────────────────────────────

/**
 * Maps each entity type to a unique byte value embedded in packed UUIDs.
 * Used by packId() / packNonDbId() to stamp the entity type into byte 10.
 */
export const ENTITY_TYPE_MAP = {
  // Top-level / Global
  Org: 0x01,
  User: 0x02,
  // Org management
  OrgMembership: 0x03,
  AuthToken: 0x04,
  OrgInvitation: 0x05,
  // Data domain
  Collection: 0x10,
  DataSource: 0x11,
  Chunk: 0x12,
  ExtractedImage: 0x13,
  Contract: 0x14,
  // API
  ApiKey: 0x20,
  UsageLog: 0x21,
  // Chat
  ChatThread: 0x30,
  SharedChat: 0x34,
  ChatMessage: 0x38,
  // Analytics
  AiUsageLog: 0x40,
  // Integrations
  Connection: 0x50,
  // Bots
  Bot: 0x60,
  BotSigningKey: 0x61,
} as const satisfies Record<TableIdName, number>;

// ── DbId<T> ──────────────────────────────────────────────────────────────

/**
 * A branded string ID scoped to a specific database table.
 * Prevents mixing up IDs from different tables at compile time.
 *
 * @example
 * ```ts
 * function getCollection(id: DbId<'Collection'>) { ... }
 * const sourceId: DbId<'DataSource'> = ...;
 * getCollection(sourceId); // Compile error!
 * ```
 */
export type DbId<T extends TableIdName> = Tagged<string, T>;

// ── OrgNumericId ─────────────────────────────────────────────────────────

/**
 * Branded numeric ID for organizations, embedded as the first 4 bytes
 * of every packed UUID to enable fast org-scoping checks.
 */
export type OrgNumericId = Tagged<number, 'OrgNumericId'>;

/** Org numeric ID for global entities (User, AuthToken). */
// Trust boundary: literal 0 branded here at the definition site.
export const GLOBAL_ORG = 0 as OrgNumericId;

// ── UUID format ──────────────────────────────────────────────────────────

/** Regex matching a standard UUID (8-4-4-4-12 hex string). */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── packId ───────────────────────────────────────────────────────────────

/**
 * Formats a 16-byte Uint8Array as a UUID string (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).
 */
function bytesToUuid(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < 16; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return (
    hex.slice(0, 8) +
    '-' +
    hex.slice(8, 12) +
    '-' +
    hex.slice(12, 16) +
    '-' +
    hex.slice(16, 20) +
    '-' +
    hex.slice(20, 32)
  );
}

/**
 * Generates a packed UUID for a database table entity.
 *
 * Layout (16 bytes):
 * - Bytes 0-3:   orgNumericId (uint32 big-endian)
 * - Bytes 4-9:   timestamp (uint48 big-endian, ms since epoch)
 * - Byte 10:     entity type code (from ENTITY_TYPE_MAP)
 * - Bytes 11-15: crypto random
 */
export function packId<T extends TableIdName>(
  entityType: T,
  org: DbId<'Org'> | OrgNumericId
): DbId<T> {
  const buf = new Uint8Array(16);
  const view = new DataView(buf.buffer);

  const orgNum = typeof org === 'string' ? extractOrgNumericId(org) : org;
  view.setUint32(0, orgNum, false);

  const now = Date.now();
  view.setUint16(4, Math.floor(now / 0x100000000), false);
  view.setUint32(6, now >>> 0, false);

  buf[10] = ENTITY_TYPE_MAP[entityType];

  const random = new Uint8Array(5);
  crypto.getRandomValues(random);
  buf.set(random, 11);

  return bytesToUuid(buf) as DbId<T>;
}

// ── Extraction helpers ───────────────────────────────────────────────────

/** Strips hyphens from a UUID string to get a 32-char hex string. */
function stripHyphens(uuid: string): string {
  return uuid.replace(/-/g, '');
}

/** Extracts the org numeric ID (bytes 0-3) from a packed UUID. */
export function extractOrgNumericId(uuid: string): OrgNumericId {
  const hex = stripHyphens(uuid);
  // Trust boundary: parseInt returns number, branded here at the extraction point
  return parseInt(hex.slice(0, 8), 16) as OrgNumericId;
}

/** Returns true if the packed UUID belongs to the given org. */
export function idBelongsToOrg(id: string, orgNumericId: OrgNumericId): boolean {
  return extractOrgNumericId(id) === orgNumericId;
}

/** Throws if any of the given IDs do not belong to the same org as orgId. */
export function assertIdsInOrg(orgId: DbId<'Org'>, ...ids: string[]): void {
  const orgNum = extractOrgNumericId(orgId);
  if (!ids.every((id) => idBelongsToOrg(id, orgNum))) {
    throw new Error(`One or more IDs do not belong to org ${orgId}`);
  }
}

// ── Zod schemas ──────────────────────────────────────────────────────────

/**
 * Zod schema that validates a UUID string, checks the embedded entity type byte
 * matches the expected type, and brands it as `DbId<T>`.
 */
export function dbIdSchema<T extends TableIdName>(entityType: T) {
  const expectedCode = ENTITY_TYPE_MAP[entityType];
  return z
    .string()
    .regex(UUID_RE, 'Invalid UUID format')
    .refine(
      (s) => {
        const hex = s.replace(/-/g, '');
        const entityByte = parseInt(hex.slice(20, 22), 16);
        return entityByte === expectedCode;
      },
      { message: `Expected ${entityType} ID` }
    )
    .transform((s) => s as DbId<T>);
}
