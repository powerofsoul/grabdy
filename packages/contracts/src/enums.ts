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
} as const;
export type DataSourceType = (typeof DataSourceType)[keyof typeof DataSourceType];

export const dataSourceStatusEnum = z.enum(['UPLOADED', 'PROCESSING', 'READY', 'FAILED']);
export const dataSourceTypeEnum = z.enum(['PDF', 'CSV', 'DOCX', 'TXT', 'JSON']);
export const orgRoleEnum = z.enum(['OWNER', 'ADMIN', 'MEMBER']);
