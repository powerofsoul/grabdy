import type { Tagged } from './branded.js';
import z from 'zod';

import {
  type DbId,
  type EntityIdName,
  ENTITY_TYPE_MAP,
  UUID_RE,
  bytesToUuid,
  extractOrgNumericId,
} from './id.js';

// ── NonTableIdName ───────────────────────────────────────────────────────

/**
 * PascalCase names for packed UUIDs that don't correspond to a DB table.
 * Same binary layout as DbId (org + timestamp + entity byte + random),
 * but these IDs live inside JSONB columns or other non-relational stores.
 */
export type NonTableIdName = 'CanvasCard' | 'CanvasEdge' | 'CanvasComponent';

// Re-assert that NonTableIdName is a subset of EntityIdName (compile-time check)
type _AssertSubset = NonTableIdName extends EntityIdName ? true : never;
const _check: _AssertSubset = true;
void _check;

// ── NonDbId<T> ───────────────────────────────────────────────────────────

/**
 * A branded string ID for non-table entities (packed UUID, same binary layout).
 * Lives inside JSONB or other non-relational stores, not as a PK in a table.
 *
 * @example
 * ```ts
 * type CardId = NonDbId<'CanvasCard'>;
 * function getCard(id: CardId) { ... }
 * ```
 */
export type NonDbId<T extends NonTableIdName> = Tagged<string, T>;

// ── packNonDbId ──────────────────────────────────────────────────────────

/**
 * Generates a packed UUID for a non-table entity type.
 * Accepts a `DbId<'Org'>` and extracts the numeric org ID internally.
 *
 * Layout (16 bytes):
 * - Bytes 0-3:   orgNumericId (uint32 big-endian)
 * - Bytes 4-9:   timestamp (uint48 big-endian, ms since epoch)
 * - Byte 10:     entity type code (from ENTITY_TYPE_MAP)
 * - Bytes 11-15: crypto random
 */
export function packNonDbId<T extends NonTableIdName>(
  entityType: T,
  orgId: DbId<'Org'>,
): NonDbId<T> {
  const orgNumericId = extractOrgNumericId(orgId);
  const buf = new Uint8Array(16);
  const view = new DataView(buf.buffer);

  view.setUint32(0, orgNumericId, false);

  const now = Date.now();
  view.setUint16(4, Math.floor(now / 0x100000000), false);
  view.setUint32(6, now >>> 0, false);

  buf[10] = ENTITY_TYPE_MAP[entityType];

  const random = new Uint8Array(5);
  crypto.getRandomValues(random);
  buf.set(random, 11);

  return bytesToUuid(buf) as NonDbId<T>;
}

// ── Zod schemas ──────────────────────────────────────────────────────────

/**
 * Zod schema that validates a UUID string, checks the embedded entity type byte
 * matches the expected non-table type, and brands it as `NonDbId<T>`.
 */
export function nonDbIdSchema<T extends NonTableIdName>(entityType: T) {
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
    .transform((s) => s as NonDbId<T>);
}
