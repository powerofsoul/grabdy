import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { dbIdSchema, extractOrgNumericId, packId } from '@grabdy/common';
import { AiRequestType, contractExtractionSchema, ENRICHMENT_MODEL } from '@grabdy/contracts';
import type { Job } from 'bullmq';
import { sql } from 'kysely';

import { DbService } from '../../../db/db.module';
import { AiService } from '../../ai/ai.service';
import { ENRICHMENT_LANGUAGE_MODEL } from '../../ai/bedrock.provider';

import type { ContractAnalysisJobData } from './job-data.types';

const MAX_DOCUMENT_CHARS = 100_000;
const HEAD_CHARS = 80_000;
const TAIL_CHARS = 20_000;

const SYSTEM_PROMPT = [
  'You are a contract metadata extraction assistant.',
  'Extract structured metadata from the provided document text.',
  'Use ISO 8601 date format (YYYY-MM-DD) for all dates.',
  'If an expiration date and notice period are both present, calculate noticeByDate as expirationDate minus noticePeriodDays.',
  'Return null for any field that cannot be determined from the document.',
  'For contractType: use exactly one of: "nda", "msa", "sow", "saas_agreement", "employment", "lease", "baa", "amendment", "licensing", "service_agreement", "consulting_agreement", "partnership_agreement", "vendor_agreement", "data_processing", "non_compete", "other". Use "other" only if no category fits.',
  'For counterparty: extract the company or individual name. Remove legal suffixes (Inc., LLC, Ltd., Corp., Co., L.P., LLP). Use title case.',
  'For renewalType: use "auto" for automatic renewal, "manual" for renewal requiring action, and "none" if the contract does not renew.',
  'For liabilityCapType: use "fixed" for a specific dollar amount, "percentage" for a percentage-based cap, "unlimited" if explicitly unlimited, "none" if no liability cap.',
  'For indemnificationType: use "mutual" for mutual indemnification, "one_way_us" if we indemnify them, "one_way_them" if they indemnify us, "none" if no indemnification.',
  'For ipOwnership: use "us" if we retain IP, "them" if they retain IP, "joint" for joint ownership, "not_applicable" if not relevant.',
  'For disputeMechanism: use "arbitration", "litigation", or "mediation" based on the dispute resolution clause.',
  'For paymentFrequency: use "monthly", "quarterly", "annually", "one_time", or "other".',
  'For payableValue: the amount we pay the counterparty (annual or total contract value). Use for vendor agreements, SaaS subscriptions, leases, any contract where we are the buyer.',
  'For receivableValue: the amount the counterparty pays us. Use for client contracts, SoWs where we are the provider, licensing deals where we are the licensor.',
  'A contract can have both (e.g., mutual service agreements with different payment amounts). Extract as annual values when possible for consistency.',
  'Extract monetary values as numbers without currency symbols.',
  'For title: generate a concise descriptive title from the document content. Use the format "{Type} - {Counterparty}" when both are determinable (e.g., "NDA - Acme Corp", "SaaS Agreement - CloudTech"). Otherwise use a brief descriptive summary of the contract\'s purpose.',
].join('\n');

@Processor('contract-analysis', { concurrency: 5 })
export class ContractAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(ContractAnalysisProcessor.name);

  constructor(
    private db: DbService,
    private aiService: AiService
  ) {
    super();
  }

  async process(job: Job<ContractAnalysisJobData>): Promise<void> {
    const { orgId, dataSourceId } = job.data;

    try {
      const parsedOrgId = dbIdSchema('Org').parse(orgId);
      const parsedDataSourceId = dbIdSchema('DataSource').parse(dataSourceId);

      // Fetch data source title
      const dataSource = await this.db.kysely
        .selectFrom('data.data_sources')
        .select(['title'])
        .where('id', '=', parsedDataSourceId)
        .where('org_id', '=', parsedOrgId)
        .executeTakeFirst();

      if (!dataSource) {
        this.logger.debug(`Data source ${dataSourceId} not found, skipping contract analysis`);
        return;
      }

      // Fetch all chunks for this data source, ordered by chunk_index
      const chunks = await this.db.kysely
        .selectFrom('data.chunks')
        .select(['content'])
        .where('data_source_id', '=', parsedDataSourceId)
        .where('org_id', '=', parsedOrgId)
        .orderBy('chunk_index', 'asc')
        .execute();

      if (chunks.length === 0) {
        this.logger.debug(
          `No chunks found for data source ${dataSourceId}, skipping contract analysis`
        );
        return;
      }

      // Concatenate all chunk content
      const fullText = chunks.map((c) => c.content).join('\n');

      // For large documents, use the first 80k + last 20k characters
      let documentText = fullText;
      if (fullText.length > MAX_DOCUMENT_CHARS) {
        const head = fullText.slice(0, HEAD_CHARS);
        const tail = fullText.slice(-TAIL_CHARS);
        documentText = head + '\n\n[... middle content omitted for length ...]\n\n' + tail;
      }

      const extractedAt = new Date();
      const extraction = await this.aiService.generateStructuredObject(
        contractExtractionSchema,
        {
          model: ENRICHMENT_LANGUAGE_MODEL,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Extract contract metadata from the following document:\n\n${documentText}`,
            },
          ],
          temperature: 0,
        },
        ENRICHMENT_MODEL,
        AiRequestType.CONTRACT_ANALYSIS,
        {
          orgId: parsedOrgId,
          source: 'SYSTEM',
          callerType: 'SYSTEM',
          description: `Contract metadata extraction for ${dataSourceId}`,
        }
      );

      const orgNum = extractOrgNumericId(parsedOrgId);
      const contractId = packId('Contract', orgNum);

      // Default undefined fields to null (AI model omits fields it can't determine)
      // Normalize counterparty name: reuse existing casing from this org if present
      let counterparty = extraction.counterparty ?? null;
      if (counterparty) {
        const existing = await this.db.kysely
          .selectFrom('data.contracts')
          .select('counterparty')
          .where('org_id', '=', parsedOrgId)
          .where('data_source_id', '!=', parsedDataSourceId)
          .where(sql`lower(counterparty)`, '=', counterparty.toLowerCase())
          .limit(1)
          .executeTakeFirst();
        if (existing?.counterparty) {
          counterparty = existing.counterparty;
        }
      }
      const contractType = extraction.contractType ?? null;
      const governingLaw = extraction.governingLaw ?? null;
      const jurisdiction = extraction.jurisdiction ?? null;
      const effectiveDate = extraction.effectiveDate ?? null;
      const expirationDate = extraction.expirationDate ?? null;
      const executionDate = extraction.executionDate ?? null;
      const renewalType = extraction.renewalType ?? null;
      const renewalDate = extraction.renewalDate ?? null;
      const renewalTermMonths = extraction.renewalTermMonths ?? null;
      const noticePeriodDays = extraction.noticePeriodDays ?? null;
      const noticeByDate = extraction.noticeByDate ?? null;
      const payableValue = extraction.payableValue ?? null;
      const receivableValue = extraction.receivableValue ?? null;
      const currency = extraction.currency ?? null;
      const paymentTerms = extraction.paymentTerms ?? null;
      const paymentFrequency = extraction.paymentFrequency ?? null;
      const liabilityCapAmount = extraction.liabilityCapAmount ?? null;
      const liabilityCapType = extraction.liabilityCapType ?? null;
      const indemnificationType = extraction.indemnificationType ?? null;
      const terminationForCause = extraction.terminationForCause ?? null;
      const terminationForConvenience = extraction.terminationForConvenience ?? null;
      const terminationNoticeDays = extraction.terminationNoticeDays ?? null;
      const ipOwnership = extraction.ipOwnership ?? null;
      const workForHire = extraction.workForHire ?? null;
      const confidentialityTermMonths = extraction.confidentialityTermMonths ?? null;
      const nonCompete = extraction.nonCompete ?? null;
      const nonCompeteTermMonths = extraction.nonCompeteTermMonths ?? null;
      const nonSolicitation = extraction.nonSolicitation ?? null;
      const insuranceRequired = extraction.insuranceRequired ?? null;
      const insuranceMinimumAmount = extraction.insuranceMinimumAmount ?? null;
      const disputeMechanism = extraction.disputeMechanism ?? null;
      const disputeVenue = extraction.disputeVenue ?? null;

      // Compute confidence as ratio of non-null extracted fields
      const extractedFields = [
        counterparty,
        contractType,
        governingLaw,
        jurisdiction,
        effectiveDate,
        expirationDate,
        executionDate,
        renewalType,
        payableValue,
        receivableValue,
        paymentTerms,
      ];
      const filledCount = extractedFields.filter((f) => f != null).length;
      const extractionConfidence = Math.round((filledCount / extractedFields.length) * 100) / 100;

      const contractValues = {
        title: extraction.title ?? dataSource.title,
        counterparty,
        contract_type: contractType,
        governing_law: governingLaw,
        jurisdiction,
        effective_date: effectiveDate,
        expiration_date: expirationDate,
        execution_date: executionDate,
        renewal_type: renewalType,
        renewal_date: renewalDate,
        renewal_term_months: renewalTermMonths,
        notice_period_days: noticePeriodDays,
        notice_by_date: noticeByDate,
        payable_value: payableValue != null ? String(payableValue) : null,
        receivable_value: receivableValue != null ? String(receivableValue) : null,
        currency,
        payment_terms: paymentTerms,
        payment_frequency: paymentFrequency,
        liability_cap_amount: liabilityCapAmount != null ? String(liabilityCapAmount) : null,
        liability_cap_type: liabilityCapType,
        indemnification_type: indemnificationType,
        termination_for_cause: terminationForCause,
        termination_for_convenience: terminationForConvenience,
        termination_notice_days: terminationNoticeDays,
        ip_ownership: ipOwnership,
        work_for_hire: workForHire,
        confidentiality_term_months: confidentialityTermMonths,
        non_compete: nonCompete,
        non_compete_term_months: nonCompeteTermMonths,
        non_solicitation: nonSolicitation,
        insurance_required: insuranceRequired,
        insurance_minimum_amount:
          insuranceMinimumAmount != null ? String(insuranceMinimumAmount) : null,
        dispute_mechanism: disputeMechanism,
        dispute_venue: disputeVenue,
        extraction_confidence: extractionConfidence,
        extracted_at: extractedAt,
        updated_at: new Date(),
      };

      // Upsert into contracts table (keyed on data_source_id via unique index)
      await this.db.kysely
        .insertInto('data.contracts')
        .values({
          id: contractId,
          org_id: parsedOrgId,
          data_source_id: parsedDataSourceId,
          ...contractValues,
        })
        .onConflict((oc) => oc.column('data_source_id').doUpdateSet(contractValues))
        .execute();

      this.logger.log(`Contract analysis complete for data source ${dataSourceId}`);
    } catch (error) {
      this.logger.error({ err: error }, `Contract analysis failed for data source ${dataSourceId}`);
      throw error;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}(${job.id}) failed: ${err.message}`);
  }
}
