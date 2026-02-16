import { z } from 'zod';

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const TokenType = {
  PASSWORD_RESET: 'PASSWORD_RESET',
  EMAIL_VERIFY: 'EMAIL_VERIFY',
} as const;
export type TokenType = (typeof TokenType)[keyof typeof TokenType];

export const OrgRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const;
export type OrgRole = (typeof OrgRole)[keyof typeof OrgRole];

export const DataSourceStatus = {
  UPLOADED: 'UPLOADED',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED: 'FAILED',
} as const;
export type DataSourceStatus = (typeof DataSourceStatus)[keyof typeof DataSourceStatus];

export const DataSourceType = {
  PDF: 'PDF',
  CSV: 'CSV',
  DOCX: 'DOCX',
  TXT: 'TXT',
  JSON: 'JSON',
  XLSX: 'XLSX',
  IMAGE: 'IMAGE',
  SLACK: 'SLACK',
} as const;
export type DataSourceType = (typeof DataSourceType)[keyof typeof DataSourceType];

const objectValues = <T extends Record<string, string>>(obj: T) =>
  Object.values(obj) as [T[keyof T], ...T[keyof T][]];

export const IntegrationProvider = {
  SLACK: 'SLACK',
} as const;
export type IntegrationProvider = (typeof IntegrationProvider)[keyof typeof IntegrationProvider];

export const ConnectionStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR',
  DISCONNECTED: 'DISCONNECTED',
} as const;
export type ConnectionStatus = (typeof ConnectionStatus)[keyof typeof ConnectionStatus];

export const SyncStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type SyncStatus = (typeof SyncStatus)[keyof typeof SyncStatus];

export const SyncTrigger = {
  MANUAL: 'MANUAL',
  SCHEDULED: 'SCHEDULED',
  WEBHOOK: 'WEBHOOK',
} as const;
export type SyncTrigger = (typeof SyncTrigger)[keyof typeof SyncTrigger];

// ── Supported File Types (single source of truth) ───────────────────
// Every consumer (upload validation, text extraction, preview, icons)
// must derive from this map. Never duplicate mime/extension lists.

interface SupportedFileType {
  readonly mime: string;
  readonly ext: string;
  readonly type: DataSourceType;
  readonly label: string;
}

export const SUPPORTED_FILE_TYPES = [
  { mime: 'application/pdf', ext: 'pdf', type: 'PDF', label: 'PDF' },
  { mime: 'text/csv', ext: 'csv', type: 'CSV', label: 'CSV' },
  { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx', type: 'DOCX', label: 'DOCX' },
  { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx', type: 'XLSX', label: 'XLSX' },
  { mime: 'application/vnd.ms-excel', ext: 'xls', type: 'XLSX', label: 'XLS' },
  { mime: 'text/plain', ext: 'txt', type: 'TXT', label: 'TXT' },
  { mime: 'application/json', ext: 'json', type: 'JSON', label: 'JSON' },
  { mime: 'image/png', ext: 'png', type: 'IMAGE', label: 'PNG' },
  { mime: 'image/jpeg', ext: 'jpg', type: 'IMAGE', label: 'JPEG' },
  { mime: 'image/webp', ext: 'webp', type: 'IMAGE', label: 'WebP' },
  { mime: 'image/gif', ext: 'gif', type: 'IMAGE', label: 'GIF' },
] as const satisfies readonly SupportedFileType[];

export type SupportedMime = (typeof SUPPORTED_FILE_TYPES)[number]['mime'];

/** Set of accepted MIME types for upload validation */
export const SUPPORTED_MIMES: ReadonlySet<string> = new Set(SUPPORTED_FILE_TYPES.map((f) => f.mime));

/** Comma-separated extensions for HTML file input accept attribute */
export const SUPPORTED_EXTENSIONS = SUPPORTED_FILE_TYPES.map((f) => `.${f.ext}`).join(',');

/** Human-readable label list (e.g. "PDF, CSV, DOCX, XLSX, TXT, JSON") */
export const SUPPORTED_LABELS = SUPPORTED_FILE_TYPES.map((f) => f.label).join(', ');

/** Map from MIME to DataSourceType — cast required because Object.fromEntries returns Record<string, V> */
export const MIME_TO_DATA_SOURCE_TYPE: Record<SupportedMime, DataSourceType> = Object.fromEntries(
  SUPPORTED_FILE_TYPES.map((f) => [f.mime, f.type]),
) as Record<SupportedMime, DataSourceType>;


export const AiCallerType = {
  MEMBER: 'MEMBER',
  SYSTEM: 'SYSTEM',
  API_KEY: 'API_KEY',
} as const;
export type AiCallerType = (typeof AiCallerType)[keyof typeof AiCallerType];

export const AiRequestType = {
  CHAT: 'CHAT',
  EMBEDDING: 'EMBEDDING',
} as const;
export type AiRequestType = (typeof AiRequestType)[keyof typeof AiRequestType];

export const AiRequestSource = {
  WEB: 'WEB',
  SLACK: 'SLACK',
  API: 'API',
  MCP: 'MCP',
  SYSTEM: 'SYSTEM',
} as const;
export type AiRequestSource = (typeof AiRequestSource)[keyof typeof AiRequestSource];

/** Fenced code block names the AI can output in chat responses. */
export const StreamBlock = {
  THINKING: 'thinking',
  SOURCES: 'sources',
} as const;
export type StreamBlock = (typeof StreamBlock)[keyof typeof StreamBlock];

export const dataSourceStatusEnum = z.enum(objectValues(DataSourceStatus));
export const dataSourceTypeEnum = z.enum(objectValues(DataSourceType));
export const orgRoleEnum = z.enum(objectValues(OrgRole));
export const integrationProviderEnum = z.enum(objectValues(IntegrationProvider));
export const connectionStatusEnum = z.enum(objectValues(ConnectionStatus));
export const syncStatusEnum = z.enum(objectValues(SyncStatus));
export const syncTriggerEnum = z.enum(objectValues(SyncTrigger));
