export const UserStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

const PW_RESET = 'PASSWORD_RESET' as const;
export const TokenType = {
  PASSWORD_RESET: PW_RESET,
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
  INTEGRATION: 'INTEGRATION',
} as const;
export type DataSourceType = (typeof DataSourceType)[keyof typeof DataSourceType];

export const AiCallerType = {
  MEMBER: 'MEMBER',
  SYSTEM: 'SYSTEM',
} as const;
export type AiCallerType = (typeof AiCallerType)[keyof typeof AiCallerType];

export const AiRequestType = {
  CHAT: 'CHAT',
  EMBEDDING: 'EMBEDDING',
} as const;
export type AiRequestType = (typeof AiRequestType)[keyof typeof AiRequestType];

export const IntegrationProvider = {
  SLACK: 'SLACK',
  JIRA: 'JIRA',
  GITHUB: 'GITHUB',
  NOTION: 'NOTION',
  CONFLUENCE: 'CONFLUENCE',
  GOOGLE_DRIVE: 'GOOGLE_DRIVE',
  ASANA: 'ASANA',
  LINEAR: 'LINEAR',
  FIGMA: 'FIGMA',
  TRELLO: 'TRELLO',
} as const;
export type IntegrationProvider = (typeof IntegrationProvider)[keyof typeof IntegrationProvider];

export const ConnectionStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR',
  REVOKED: 'REVOKED',
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
