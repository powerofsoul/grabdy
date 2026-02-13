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
  | 'ApiKey'
  | 'ChatThread'
  | 'AiUsageLog'
  | 'Connection'
  | 'SyncLog';

// ── Entity Type Maps ─────────────────────────────────────────────────────

/**
 * All entity names — DB tables + non-table entities.
 * Non-table names listed inline to avoid circular dependency with non-db-id.ts.
 */
export type EntityIdName = TableIdName | 'CanvasCard' | 'CanvasEdge' | 'CanvasComponent';

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
  // API
  ApiKey: 0x20,
  // Chat
  ChatThread: 0x30,
  CanvasCard: 0x31,
  CanvasEdge: 0x32,
  CanvasComponent: 0x33,
  // Analytics
  AiUsageLog: 0x40,
  // Integrations
  Connection: 0x50,
  SyncLog: 0x51,
} as const satisfies Record<EntityIdName, number>;

const ENTITY_TYPE_REVERSE: Record<number, EntityIdName> = Object.fromEntries(
  Object.entries(ENTITY_TYPE_MAP).map(([k, v]) => [v, k]),
) as Record<number, EntityIdName>;

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
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── packId ───────────────────────────────────────────────────────────────

/**
 * Formats a 16-byte Uint8Array as a UUID string (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).
 */
export function bytesToUuid(bytes: Uint8Array): string {
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
  org: DbId<'Org'> | OrgNumericId,
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

/** Extracts the entity type (byte 10) from a packed UUID. Returns null if unknown. */
export function extractEntityType(uuid: string): EntityIdName | null {
  const hex = stripHyphens(uuid);
  const entityByte = parseInt(hex.slice(20, 22), 16);
  return ENTITY_TYPE_REVERSE[entityByte] ?? null;
}

/** Extracts the timestamp (bytes 4-9) from a packed UUID as a Date. */
export function extractTimestamp(uuid: string): Date {
  const hex = stripHyphens(uuid);
  const msHex = hex.slice(8, 20);
  const ms = parseInt(msHex, 16);
  return new Date(ms);
}

/** Returns true if two packed UUIDs share the same org (bytes 0-3). */
export function idsShareOrg(a: string, b: string): boolean {
  const hexA = stripHyphens(a);
  const hexB = stripHyphens(b);
  return hexA.slice(0, 8) === hexB.slice(0, 8);
}

/** Returns true if the packed UUID belongs to the given org. */
export function idBelongsToOrg(
  id: string,
  orgNumericId: OrgNumericId,
): boolean {
  return extractOrgNumericId(id) === orgNumericId;
}

/** Returns true if the packed UUID has the expected entity type byte. */
export function isEntityType<T extends EntityIdName>(
  id: string,
  expected: T,
): boolean {
  const hex = stripHyphens(id);
  const entityByte = parseInt(hex.slice(20, 22), 16);
  return entityByte === ENTITY_TYPE_MAP[expected];
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
      { message: `Expected ${entityType} ID` },
    )
    .transform((s) => s as DbId<T>);
}
