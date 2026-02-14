import type { DbId, OrgNumericId } from '@grabdy/common';
import type { CanvasState } from '@grabdy/contracts';
import type { ColumnType, GeneratedAlways } from 'kysely';

import type {
  AiCallerType,
  AiRequestType,
  ConnectionStatus,
  DataSourceStatus,
  DataSourceType,
  IntegrationProvider,
  OrgRole,
  SyncStatus,
  SyncTrigger,
  TokenType,
  UserStatus,
} from './enums';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Column has a DB-side default; optional on INSERT, required on SELECT. */
export type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>;

/** Timestamp columns accept Date | string on insert/update. */
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export interface User {
  id: Generated<DbId<'User'>>;
  email: string;
  name: string;
  password_hash: string | null;
  email_verified: Generated<boolean>;
  status: Generated<UserStatus>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
}

export interface AuthToken {
  id: Generated<DbId<'AuthToken'>>;
  token: string;
  type: TokenType;
  expires_at: Timestamp;
  used_at: Timestamp | null;
  created_at: Generated<Timestamp>;
  user_id: DbId<'User'>;
}

export interface Org {
  id: Generated<DbId<'Org'>>;
  name: string;
  numeric_id: Generated<OrgNumericId>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
}

export interface OrgMembership {
  id: Generated<DbId<'OrgMembership'>>;
  roles: OrgRole[];
  created_at: Generated<Timestamp>;
  user_id: DbId<'User'>;
  org_id: DbId<'Org'>;
}

export interface OrgInvitation {
  id: Generated<DbId<'OrgInvitation'>>;
  email: string;
  name: string;
  roles: OrgRole[];
  token: string;
  expires_at: Timestamp;
  created_at: Generated<Timestamp>;
  org_id: DbId<'Org'>;
}

export interface Collection {
  id: Generated<DbId<'Collection'>>;
  name: string;
  description: string | null;
  org_id: DbId<'Org'>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
}

export interface DataSource {
  id: Generated<DbId<'DataSource'>>;
  name: string;
  filename: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  type: DataSourceType;
  status: Generated<DataSourceStatus>;
  summary: string | null;
  page_count: number | null;
  collection_id: DbId<'Collection'> | null;
  connection_id: DbId<'Connection'> | null;
  external_id: string | null;
  ai_tags: string[] | null;
  ai_description: string | null;
  org_id: DbId<'Org'>;
  uploaded_by_id: DbId<'User'> | null;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
}

export interface Chunk {
  id: Generated<DbId<'Chunk'>>;
  content: string;
  chunk_index: number;
  metadata: Record<string, unknown> | null;
  embedding: string; // vector(1536) stored as string
  data_source_id: DbId<'DataSource'>;
  collection_id: DbId<'Collection'> | null;
  org_id: DbId<'Org'>;
  created_at: Generated<Timestamp>;
}

export interface ExtractedImage {
  id: Generated<DbId<'ExtractedImage'>>;
  data_source_id: DbId<'DataSource'>;
  storage_path: string;
  mime_type: string;
  page_number: number | null;
  ai_description: string | null;
  org_id: DbId<'Org'>;
  created_at: Generated<Timestamp>;
}

export interface Connection {
  id: Generated<DbId<'Connection'>>;
  provider: IntegrationProvider;
  status: Generated<ConnectionStatus>;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: Timestamp | null;
  scopes: string[] | null;
  external_account_id: string | null;
  external_account_name: string | null;
  sync_cursor: Record<string, unknown> | null;
  last_synced_at: Timestamp | null;
  sync_enabled: Generated<boolean>;
  sync_interval_minutes: Generated<number>;
  config: Generated<Record<string, unknown>>;
  webhook_id: string | null;
  webhook_secret: string | null;
  org_id: DbId<'Org'>;
  created_by_id: DbId<'User'>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
}

export interface SyncLog {
  id: Generated<DbId<'SyncLog'>>;
  connection_id: DbId<'Connection'>;
  status: Generated<SyncStatus>;
  trigger: SyncTrigger;
  items_synced: Generated<number>;
  items_failed: Generated<number>;
  error_message: string | null;
  started_at: Timestamp | null;
  completed_at: Timestamp | null;
  org_id: DbId<'Org'>;
  created_at: Generated<Timestamp>;
}

export interface ApiKey {
  id: Generated<DbId<'ApiKey'>>;
  name: string;
  key_hash: string;
  key_prefix: string;
  org_id: DbId<'Org'>;
  created_by_id: DbId<'User'>;
  last_used_at: Timestamp | null;
  revoked_at: Timestamp | null;
  created_at: Generated<Timestamp>;
}

export interface ChatThread {
  id: Generated<DbId<'ChatThread'>>;
  title: string | null;
  collection_id: DbId<'Collection'> | null;
  canvas_state: ColumnType<CanvasState | null, CanvasState | null | undefined, CanvasState | null>;
  org_id: DbId<'Org'>;
  membership_id: DbId<'OrgMembership'>;
  created_at: Generated<Timestamp>;
  updated_at: Timestamp;
}

export interface AiUsageLog {
  id: Generated<DbId<'AiUsageLog'>>;
  model: string;
  provider: string;
  caller_type: AiCallerType;
  request_type: AiRequestType;
  input_tokens: Generated<number>;
  output_tokens: Generated<number>;
  total_tokens: Generated<number>;
  cost: Generated<number>;
  duration_ms: number | null;
  finish_reason: string | null;
  streaming: Generated<boolean>;
  org_id: DbId<'Org'>;
  user_id: DbId<'User'> | null;
  created_at: Generated<Timestamp>;
}

export interface UsageLog {
  id: GeneratedAlways<string>;
  api_key_id: DbId<'ApiKey'>;
  endpoint: string;
  input_tokens: Generated<number>;
  output_tokens: Generated<number>;
  org_id: DbId<'Org'>;
  created_at: Generated<Timestamp>;
}

// ---------------------------------------------------------------------------
// External tables (managed by Mastra, not our migrations)
// ---------------------------------------------------------------------------

export interface MastraMessage {
  id: string;
  thread_id: string;
  content: string;
  role: string;
  type: string;
  createdAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Database interface -- maps table names to their row types
// ---------------------------------------------------------------------------

export interface DB {
  // auth
  'auth.users': User;
  'auth.auth_tokens': AuthToken;
  // org
  'org.orgs': Org;
  'org.org_memberships': OrgMembership;
  'org.org_invitations': OrgInvitation;
  // data
  'data.collections': Collection;
  'data.data_sources': DataSource;
  'data.chunks': Chunk;
  'data.extracted_images': ExtractedImage;
  'data.connections': Connection;
  'data.sync_logs': SyncLog;
  'data.chat_threads': ChatThread;
  // analytics
  'analytics.ai_usage_logs': AiUsageLog;
  // api
  'api.api_keys': ApiKey;
  'api.usage_logs': UsageLog;
  // agent (managed by Mastra)
  'agent.mastra_messages': MastraMessage;
}
