import type { UploadsMime } from '@grabdy/contracts';

// ── Auth ────────────────────────────────────────────────────────────
export const BCRYPT_SALT_ROUNDS = 10;
export const OTP_MIN = 100000;
export const OTP_MAX = 999999;
export const OTP_EXPIRY_MINUTES = 15;
export const JWT_EXPIRY = '7d';
export const JWT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// ── Rate Limiting (ThrottlerModule) ─────────────────────────────────
export const THROTTLE_SHORT_TTL_MS = 1000;
export const THROTTLE_SHORT_LIMIT = 10;
export const THROTTLE_MEDIUM_TTL_MS = 60_000;
export const THROTTLE_MEDIUM_LIMIT = 100;
export const THROTTLE_LONG_TTL_MS = 3_600_000;
export const THROTTLE_LONG_LIMIT = 1000;

// ── Queue / Job Processing ──────────────────────────────────────────
export const JOB_REMOVE_ON_COMPLETE_AGE_S = 3600;
export const JOB_REMOVE_ON_COMPLETE_COUNT = 100;
export const JOB_REMOVE_ON_FAIL_AGE_S = 86400;
export const JOB_REMOVE_ON_FAIL_COUNT = 200;
export const JOB_MAX_ATTEMPTS = 3;
export const JOB_BACKOFF_DELAY_MS = 1000;

// ── Data Source Processing ──────────────────────────────────────────
export const CHUNK_SIZE = 1000;
export const CHUNK_OVERLAP = 200;
export const EMBEDDING_BATCH_SIZE = 100;
export const SUMMARY_MAX_LENGTH = 500;

// ── File Upload ─────────────────────────────────────────────────────
export const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB — multer ceiling

export const FILE_SIZE_LIMITS: Partial<Record<UploadsMime, number>> = {
  'application/pdf': 200 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 200 * 1024 * 1024,
  'application/msword': 200 * 1024 * 1024,
  'text/csv': 50 * 1024 * 1024,
  'text/plain': 50 * 1024 * 1024,
  'application/json': 50 * 1024 * 1024,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 50 * 1024 * 1024,
  'application/vnd.ms-excel': 50 * 1024 * 1024,
  'image/png': 20 * 1024 * 1024,
  'image/jpeg': 20 * 1024 * 1024,
  'image/webp': 20 * 1024 * 1024,
  'image/gif': 20 * 1024 * 1024,
};

const DEFAULT_FILE_SIZE_LIMIT = 50 * 1024 * 1024; // 50 MB

export function getMaxFileSizeForMime(mime: string): number {
  const limits: Partial<Record<string, number>> = FILE_SIZE_LIMITS;
  return limits[mime] ?? DEFAULT_FILE_SIZE_LIMIT;
}

// ── Retrieval ───────────────────────────────────────────────────────
export const DEFAULT_SEARCH_LIMIT = 10;
export const THREAD_TITLE_MAX_LENGTH = 100;

// ── API Keys ────────────────────────────────────────────────────────
export const API_KEY_RANDOM_BYTES = 32;
export const API_KEY_PREFIX_LENGTH = 12;

// ── Invitations ─────────────────────────────────────────────────────
export const INVITE_TOKEN_BYTES = 32;
export const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
