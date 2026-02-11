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
