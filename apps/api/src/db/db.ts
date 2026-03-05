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

/** Chunk metadata — discriminated union keyed on `type`. */
type ChunkMeta =
  | { type: 'PDF'; pages: number[] }
  | { type: 'DOCX'; pages: number[] }
  | { type: 'XLSX'; sheet: string; row: number; columns: string[] }
  | { type: 'CSV'; row: number; columns: string[] }
  | { type: 'TXT' }
  | { type: 'JSON' }
  | { type: 'IMAGE' }
  | {
      type: 'EMAIL';
      emailFrom: string;
      emailTo: string[];
      emailSubject: string;
      emailDate: string;
      emailRfcMessageRef: string | null;
    };

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
    domain: string | null;
    stripe_customer_id: string | null;
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
    parent_id: DbId<'Collection'> | null;
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
    type: 'PDF' | 'CSV' | 'DOCX' | 'TXT' | 'JSON' | 'XLSX' | 'IMAGE' | 'EMAIL';
    status: Generated<'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED' | 'DELETING'>;
    page_count: number | null;
    collection_id: DbId<'Collection'> | null;
    processing_progress: Generated<number>;
    source_url: string;
    parent_data_source_id: DbId<'DataSource'> | null;
    classification: unknown | null;
    uploaded_by_id: DbId<'User'> | null;
    created_at: Generated<Timestamp>;
    updated_at: Timestamp;
  };

  'data.contracts': {
    id: Generated<DbId<'Contract'>>;
    org_id: DbId<'Org'>;
    data_source_id: DbId<'DataSource'>;
    title: string;
    counterparty: string | null;
    contract_type: string | null;
    governing_law: string | null;
    jurisdiction: string | null;
    effective_date: string | null;
    expiration_date: string | null;
    execution_date: string | null;
    renewal_type: string | null;
    renewal_date: string | null;
    renewal_term_months: number | null;
    notice_period_days: number | null;
    notice_by_date: string | null;
    payable_value: string | null;
    receivable_value: string | null;
    currency: string | null;
    payment_terms: string | null;
    payment_frequency: string | null;
    liability_cap_amount: string | null;
    liability_cap_type: string | null;
    indemnification_type: string | null;
    termination_for_cause: boolean | null;
    termination_for_convenience: boolean | null;
    termination_notice_days: number | null;
    ip_ownership: string | null;
    work_for_hire: boolean | null;
    confidentiality_term_months: number | null;
    non_compete: boolean | null;
    non_compete_term_months: number | null;
    non_solicitation: boolean | null;
    insurance_required: boolean | null;
    insurance_minimum_amount: string | null;
    dispute_mechanism: string | null;
    dispute_venue: string | null;
    extraction_confidence: number | null;
    extracted_at: Timestamp | null;
    created_at: Generated<Timestamp>;
    updated_at: Timestamp;
  };

  'data.extracted_images': {
    id: Generated<DbId<'ExtractedImage'>>;
    data_source_id: DbId<'DataSource'>;
    storage_path: string;
    mime_type: string;
    page_number: number | null;
    ai_description: string | null;
    width: number | null;
    height: number | null;
    file_size: number | null;
    org_id: DbId<'Org'>;
    created_at: Generated<Timestamp>;
  };

  'data.chunks': {
    id: Generated<DbId<'Chunk'>>;
    org_id: DbId<'Org'>;
    content: string;
    chunk_index: number;
    metadata: ChunkMeta;
    source_url: string | null;
    source_key: string | null;
    embedding: string | null;
    embedding_context: string | null;
    extracted_image_id: DbId<'ExtractedImage'> | null;
    tsv: ColumnType<string, never, never>;
    data_source_id: DbId<'DataSource'>;
    collection_id: DbId<'Collection'> | null;
    created_at: Generated<Timestamp>;
  };

  'data.chat_threads': {
    id: Generated<DbId<'ChatThread'>>;
    org_id: DbId<'Org'>;
    title: string | null;
    membership_id: DbId<'OrgMembership'> | null;
    source: Generated<'dashboard'>;
    created_at: Generated<Timestamp>;
    updated_at: Timestamp;
  };

  'analytics.ai_usage_logs': {
    id: Generated<DbId<'AiUsageLog'>>;
    org_id: DbId<'Org'>;
    model: string;
    provider: string;
    caller_type: 'MEMBER' | 'SYSTEM';
    request_type:
      | 'CHAT'
      | 'EMBEDDING'
      | 'RERANK'
      | 'HYDE'
      | 'SUMMARY'
      | 'CLASSIFICATION'
      | 'ENRICHMENT'
      | 'IMAGE_ANALYSIS'
      | 'CONTRACT_ANALYSIS';
    description: string | null;
    source: 'WEB' | 'SYSTEM';
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
    share_token: string;
    accent_color: string | null;
    primary_color: string | null;
    image_ids: Generated<DbId<'ExtractedImage'>[]>;
    is_public: Generated<boolean>;
    revoked: Generated<boolean>;
    created_at: Generated<Timestamp>;
  };

  'agent.chat_messages': {
    id: Generated<DbId<'ChatMessage'>>;
    thread_id: DbId<'ChatThread'>;
    org_id: DbId<'Org'>;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    attachments: ColumnType<
      Array<{ fileName: string; mimeType: string; fileSize: number; storageKey: string }> | null,
      string | null,
      string | null
    >;
    metadata: ColumnType<
      {
        thinkingTexts?: string[];
        sources?: Array<{
          type: string;
          dataSourceId: DbId<'DataSource'>;
          dataSourceName: string;
          score: number;
          sourceUrl?: string | null;
          pages?: number[];
          content?: string;
          sheet?: string;
          rows?: number[];
          columns?: string[];
        }>;
      } | null,
      string | null,
      string | null
    >;
    duration_ms: number | null;
    created_at: Generated<Timestamp>;
  };
}
