import type { DbId, OrgNumericId } from '@grabdy/common';
import type { ColumnType } from 'kysely';

// The only export here MUST be the DB interface — do not export any helper types
// or functions from this file. Put all helpers in db.module.ts instead.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Column has a DB-side default; optional on INSERT, required on SELECT. */
type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>;

/** Timestamp columns accept Date | string on insert/update. */
type Timestamp = ColumnType<Date, Date | string, Date | string>;

// ---------------------------------------------------------------------------
// JSONB column types (opaque at DB level — consumers parse with Zod schemas)
// ---------------------------------------------------------------------------

/** Provider-specific connection data — discriminated union keyed on `provider`. */
type ConnectionProviderData =
  | {
      provider: 'SLACK';
      slackBotUserId?: string;
      teamDomain?: string;
      channelTimestamps: Record<string, string>;
    }
  | {
      provider: 'LINEAR';
      workspaceSlug?: string;
      lastIssueSyncedAt: string | null;
    }
  | {
      provider: 'GITHUB';
      githubInstallationId: number;
      installationOwner?: string;
      lastSyncedAt: string | null;
    }
  | {
      provider: 'NOTION';
      workspaceName?: string;
      notionWorkspaceId?: string;
      lastSyncedAt: string | null;
    };

/** Chunk metadata — discriminated union keyed on `type`. */
type ChunkMeta =
  | { type: 'PDF'; pages: number[] }
  | { type: 'DOCX'; pages: number[] }
  | { type: 'XLSX'; sheet: string; row: number; columns: string[] }
  | { type: 'CSV'; row: number; columns: string[] }
  | { type: 'TXT' }
  | { type: 'JSON' }
  | { type: 'IMAGE' }
  | { type: 'SLACK'; slackChannelId: string; slackMessageTs: string; slackAuthor: string }
  | { type: 'LINEAR'; linearIssueId: string; linearCommentId: string | null }
  | {
      type: 'GITHUB';
      githubItemType: 'issue' | 'pull_request' | 'discussion';
      githubCommentId: string | null;
    }
  | { type: 'NOTION'; notionPageId: string; notionBlockId: string | null };

// ---------------------------------------------------------------------------
// Database interface — maps schema.table names to their column types
// ---------------------------------------------------------------------------

export interface DB {
  'auth.users': {
    id: Generated<DbId<'User'>>;
    email: string;
    first_name: string;
    last_name: string;
    password_hash: string | null;
    google_id: string | null;
    email_verified: Generated<boolean>;
    status: Generated<'ACTIVE' | 'INACTIVE'>;
    created_at: Generated<Timestamp>;
    updated_at: Timestamp;
  };

  'auth.auth_tokens': {
    id: Generated<DbId<'AuthToken'>>;
    token: string;
    type: 'PASSWORD_RESET' | 'EMAIL_VERIFY';
    expires_at: Timestamp;
    used_at: Timestamp | null;
    created_at: Generated<Timestamp>;
    user_id: DbId<'User'>;
  };

  'org.orgs': {
    id: Generated<DbId<'Org'>>;
    name: string;
    numeric_id: Generated<OrgNumericId>;
    created_at: Generated<Timestamp>;
    updated_at: Timestamp;
  };

  'org.org_memberships': {
    id: Generated<DbId<'OrgMembership'>>;
    org_id: DbId<'Org'>;
    roles: ('OWNER' | 'ADMIN' | 'MEMBER')[];
    created_at: Generated<Timestamp>;
    user_id: DbId<'User'>;
  };

  'org.org_invitations': {
    id: Generated<DbId<'OrgInvitation'>>;
    org_id: DbId<'Org'>;
    email: string;
    roles: ('OWNER' | 'ADMIN' | 'MEMBER')[];
    token: string;
    expires_at: Timestamp;
    created_at: Generated<Timestamp>;
  };

  'data.collections': {
    id: Generated<DbId<'Collection'>>;
    org_id: DbId<'Org'>;
    name: string;
    description: string | null;
    created_at: Generated<Timestamp>;
    updated_at: Timestamp;
  };

  'data.data_sources': {
    id: Generated<DbId<'DataSource'>>;
    org_id: DbId<'Org'>;
    title: string;
    mime_type: string;
    file_size: number;
    storage_path: string;
    type:
      | 'PDF'
      | 'CSV'
      | 'DOCX'
      | 'TXT'
      | 'JSON'
      | 'XLSX'
      | 'IMAGE'
      | 'SLACK'
      | 'LINEAR'
      | 'GITHUB'
      | 'NOTION';
    status: Generated<'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED'>;
    summary: string | null;
    page_count: number | null;
    collection_id: DbId<'Collection'> | null;
    connection_id: DbId<'Connection'> | null;
    external_id: string | null;
    source_url: string;
    uploaded_by_id: DbId<'User'> | null;
    created_at: Generated<Timestamp>;
    updated_at: Timestamp;
  };

  'data.chunks': {
    id: Generated<DbId<'Chunk'>>;
    org_id: DbId<'Org'>;
    content: string;
    chunk_index: number;
    metadata: ChunkMeta;
    source_url: string;
    embedding: string;
    data_source_id: DbId<'DataSource'>;
    collection_id: DbId<'Collection'> | null;
    created_at: Generated<Timestamp>;
  };

  'data.extracted_images': {
    id: Generated<DbId<'ExtractedImage'>>;
    org_id: DbId<'Org'>;
    data_source_id: DbId<'DataSource'>;
    storage_path: string;
    mime_type: string;
    page_number: number | null;
    ai_description: string | null;
    created_at: Generated<Timestamp>;
  };

  'data.chat_threads': {
    id: Generated<DbId<'ChatThread'>>;
    org_id: DbId<'Org'>;
    title: string | null;
    collection_id: DbId<'Collection'> | null;
    canvas_state: ColumnType<
      Record<string, unknown> | null,
      Record<string, unknown> | null | undefined,
      Record<string, unknown> | null
    >;
    membership_id: DbId<'OrgMembership'>;
    created_at: Generated<Timestamp>;
    updated_at: Timestamp;
  };

  'integration.connections': {
    id: Generated<DbId<'Connection'>>;
    org_id: DbId<'Org'>;
    provider: 'SLACK' | 'LINEAR' | 'GITHUB' | 'NOTION';
    status: Generated<'ACTIVE' | 'PAUSED' | 'ERROR' | 'DISCONNECTED'>;
    access_token: string;
    refresh_token: string | null;
    token_expires_at: Timestamp | null;
    scopes: string[] | null;
    external_account_id: string | null;
    external_account_name: string | null;
    last_synced_at: Timestamp | null;
    provider_data: Generated<ConnectionProviderData>;
    created_by_id: DbId<'User'>;
    created_at: Generated<Timestamp>;
    updated_at: Timestamp;
  };

  'api.api_keys': {
    id: Generated<DbId<'ApiKey'>>;
    org_id: DbId<'Org'>;
    name: string;
    key_hash: string;
    key_prefix: string;
    created_by_id: DbId<'User'>;
    last_used_at: Timestamp | null;
    revoked_at: Timestamp | null;
    created_at: Generated<Timestamp>;
  };

  'api.usage_logs': {
    id: Generated<DbId<'UsageLog'>>;
    org_id: DbId<'Org'>;
    api_key_id: DbId<'ApiKey'>;
    endpoint: string;
    input_tokens: Generated<number>;
    output_tokens: Generated<number>;
    created_at: Generated<Timestamp>;
  };

  'analytics.ai_usage_logs': {
    id: Generated<DbId<'AiUsageLog'>>;
    org_id: DbId<'Org'>;
    model: string;
    provider: string;
    caller_type: 'MEMBER' | 'SYSTEM' | 'API_KEY';
    request_type: 'CHAT' | 'EMBEDDING';
    source: 'WEB' | 'SLACK' | 'API' | 'MCP' | 'SYSTEM';
    input_tokens: Generated<number>;
    output_tokens: Generated<number>;
    total_tokens: Generated<number>;
    cost: Generated<number>;
    duration_ms: number | null;
    finish_reason: string | null;
    streaming: Generated<boolean>;
    user_id: DbId<'User'> | null;
    created_at: Generated<Timestamp>;
  };

  'data.shared_chats': {
    id: Generated<DbId<'SharedChat'>>;
    thread_id: DbId<'ChatThread'>;
    org_id: DbId<'Org'>;
    membership_id: DbId<'OrgMembership'>;
    title: string | null;
    messages_snapshot: unknown;
    canvas_state_snapshot: unknown | null;
    share_token: string;
    is_public: Generated<boolean>;
    revoked: Generated<boolean>;
    created_at: Generated<Timestamp>;
  };

  'agent.mastra_messages': {
    id: string;
    thread_id: DbId<'ChatThread'>;
    content: string;
    role: string;
    type: string;
    createdAt: Timestamp;
  };
}
