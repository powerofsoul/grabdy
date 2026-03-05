import { ENTITY_TYPE_MAP } from '@grabdy/common';
import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE data.contracts (
      id                          UUID PRIMARY KEY DEFAULT make_packed_uuid(0, ${sql.lit(ENTITY_TYPE_MAP.Contract)}),
      org_id                      UUID NOT NULL REFERENCES org.orgs(id),
      data_source_id              UUID NOT NULL REFERENCES data.data_sources(id) ON DELETE CASCADE,

      -- Identity
      title                       TEXT NOT NULL,
      counterparty                TEXT,
      contract_type               TEXT,
      governing_law               TEXT,
      jurisdiction                TEXT,

      -- Dates
      effective_date              DATE,
      expiration_date             DATE,
      execution_date              DATE,

      -- Renewal
      renewal_type                TEXT,
      renewal_date                DATE,
      renewal_term_months         INT,
      notice_period_days          INT,
      notice_by_date              DATE,

      -- Financial
      total_value                 NUMERIC,
      currency                    TEXT,
      payment_terms               TEXT,
      payment_frequency           TEXT,

      -- Liability & indemnification
      liability_cap_amount        NUMERIC,
      liability_cap_type          TEXT,
      indemnification_type        TEXT,

      -- Termination
      termination_for_cause       BOOLEAN,
      termination_for_convenience BOOLEAN,
      termination_notice_days     INT,

      -- IP
      ip_ownership                TEXT,
      work_for_hire               BOOLEAN,

      -- Confidentiality
      confidentiality_term_months INT,
      non_compete                 BOOLEAN,
      non_compete_term_months     INT,
      non_solicitation            BOOLEAN,

      -- Insurance
      insurance_required          BOOLEAN,
      insurance_minimum_amount    NUMERIC,

      -- Dispute
      dispute_mechanism           TEXT,
      dispute_venue               TEXT,

      -- AI extraction metadata
      extraction_confidence       REAL,
      extracted_at                TIMESTAMPTZ,

      -- Timestamps
      created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- ID constraints
    ALTER TABLE data.contracts ADD CONSTRAINT chk_contracts_entity_type CHECK (extract_entity_type(id) = ${sql.lit(ENTITY_TYPE_MAP.Contract)});
    ALTER TABLE data.contracts ADD CONSTRAINT chk_contracts_org CHECK (extract_org_numeric_id(id) = extract_org_numeric_id(org_id));

    -- FK org constraints
    ALTER TABLE data.contracts ADD CONSTRAINT chk_contracts_data_source_org CHECK (extract_org_numeric_id(data_source_id) = extract_org_numeric_id(org_id));

    -- Indexes
    CREATE INDEX idx_contracts_org_id ON data.contracts(org_id);
    CREATE INDEX idx_contracts_data_source_id ON data.contracts(data_source_id);
    CREATE INDEX idx_contracts_expiration ON data.contracts(org_id, expiration_date);
    CREATE UNIQUE INDEX idx_contracts_data_source_unique ON data.contracts(data_source_id);
    CREATE INDEX idx_contracts_title_trgm ON data.contracts USING gin (title gin_trgm_ops);
    CREATE INDEX idx_contracts_counterparty_trgm ON data.contracts USING gin (counterparty gin_trgm_ops);

    -- Add CONTRACT_ANALYSIS to ai_usage_logs request_type constraint
    ALTER TABLE analytics.ai_usage_logs
      DROP CONSTRAINT IF EXISTS ai_usage_logs_request_type_check;

    ALTER TABLE analytics.ai_usage_logs
      ADD CONSTRAINT ai_usage_logs_request_type_check
      CHECK (request_type IN ('CHAT', 'EMBEDDING', 'RERANK', 'HYDE', 'SUMMARY', 'CLASSIFICATION', 'ENRICHMENT', 'IMAGE_ANALYSIS', 'CONTRACT_ANALYSIS'));
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TABLE IF EXISTS data.contracts;

    ALTER TABLE analytics.ai_usage_logs
      DROP CONSTRAINT IF EXISTS ai_usage_logs_request_type_check;

    ALTER TABLE analytics.ai_usage_logs
      ADD CONSTRAINT ai_usage_logs_request_type_check
      CHECK (request_type IN ('CHAT', 'EMBEDDING', 'RERANK', 'HYDE', 'SUMMARY', 'CLASSIFICATION', 'ENRICHMENT', 'IMAGE_ANALYSIS'));
  `.execute(db);
}
