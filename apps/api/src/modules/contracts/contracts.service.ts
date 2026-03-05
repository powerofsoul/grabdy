import { Injectable, NotFoundException } from '@nestjs/common';

import { type DbId } from '@grabdy/common';
import {
  type ContractType,
  contractTypeEnum,
  type DisputeMechanism,
  disputeMechanismEnum,
  type IndemnificationType,
  indemnificationTypeEnum,
  type IpOwnership,
  ipOwnershipEnum,
  type LiabilityCapType,
  liabilityCapTypeEnum,
  type PaymentFrequency,
  paymentFrequencyEnum,
  type RenewalType,
  renewalTypeEnum,
} from '@grabdy/contracts';
import type { ExpressionOrFactory, SqlBool } from 'kysely';

import type { DB } from '../../db/db';
import { DbService } from '../../db/db.module';

function parseEnum<T>(
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
  value: string | null
): T | null {
  if (value === null) return null;
  const result = schema.safeParse(value);
  return result.success && result.data !== undefined ? result.data : null;
}

@Injectable()
export class ContractsService {
  constructor(private db: DbService) {}

  async list(
    orgId: DbId<'Org'>,
    options: {
      search?: string;
      counterparty?: string;
      contractType?: string;
      renewalType?: string;
      status?: 'active' | 'past';
      expiringBefore?: string;
      expiringAfter?: string;
      sortBy?:
        | 'title'
        | 'counterparty'
        | 'contract_type'
        | 'expiration_date'
        | 'days_left'
        | 'created_at';
      sortOrder?: 'asc' | 'desc';
      limit?: number;
      page?: number;
    }
  ) {
    const filterConditions: ExpressionOrFactory<DB, 'data.contracts', SqlBool>[] = [];

    if (options.search) {
      const escaped = options.search.replace(/[%_]/g, '\\$&');
      const pattern = `%${escaped}%`;
      filterConditions.push((eb) =>
        eb.or([eb('title', 'ilike', pattern), eb('counterparty', 'ilike', pattern)])
      );
    }
    if (options.counterparty) {
      const escaped = options.counterparty.replace(/[%_]/g, '\\$&');
      filterConditions.push((eb) => eb('counterparty', 'ilike', `%${escaped}%`));
    }
    if (options.contractType) {
      const ct = options.contractType;
      filterConditions.push((eb) => eb('contract_type', '=', ct));
    }
    if (options.expiringBefore) {
      const before = options.expiringBefore;
      filterConditions.push((eb) => eb('expiration_date', '<=', before));
    }
    if (options.expiringAfter) {
      const after = options.expiringAfter;
      filterConditions.push((eb) => eb('expiration_date', '>=', after));
    }
    if (options.renewalType) {
      const rt = options.renewalType;
      filterConditions.push((eb) => eb('renewal_type', '=', rt));
    }
    if (options.status === 'active') {
      const today = new Date().toISOString().slice(0, 10);
      filterConditions.push((eb) =>
        eb.or([eb('expiration_date', '>=', today), eb('expiration_date', 'is', null)])
      );
    } else if (options.status === 'past') {
      const today = new Date().toISOString().slice(0, 10);
      filterConditions.push((eb) => eb('expiration_date', '<', today));
    }

    let query = this.db.kysely.selectFrom('data.contracts').selectAll().where('org_id', '=', orgId);
    let countQuery = this.db.kysely
      .selectFrom('data.contracts')
      .select((eb) => eb.fn.countAll<number>().as('total'))
      .where('org_id', '=', orgId);

    for (const condition of filterConditions) {
      query = query.where(condition);
      countQuery = countQuery.where(condition);
    }

    const countResult = await countQuery.executeTakeFirstOrThrow();

    const sortCol =
      options.sortBy === 'days_left' ? 'expiration_date' : (options.sortBy ?? 'created_at');
    const sortOrder = options.sortOrder ?? 'desc';
    query = query.orderBy(sortCol, sortOrder);

    const limit = options.limit ?? 25;
    const page = options.page ?? 1;
    const offset = (page - 1) * limit;
    query = query.limit(limit).offset(offset);

    const contracts = await query.execute();
    const now = new Date();

    return {
      items: contracts.map((c) => this.toResponse(c, now)),
      total: Number(countResult.total),
      page,
      limit,
    };
  }

  async findById(orgId: DbId<'Org'>, contractId: DbId<'Contract'>) {
    const contract = await this.db.kysely
      .selectFrom('data.contracts')
      .selectAll()
      .where('id', '=', contractId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    return this.toResponse(contract, new Date());
  }

  async deadlines(orgId: DbId<'Org'>, options?: { limit?: number; page?: number }) {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const currentQuarterEnd = new Date(
      now.getFullYear(),
      Math.ceil((now.getMonth() + 1) / 3) * 3,
      0
    );
    const quarterEndStr = currentQuarterEnd.toISOString().slice(0, 10);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthEndStr = currentMonthEnd.toISOString().slice(0, 10);

    const [metrics, statusCounts, totalResult, contracts, counterpartiesResult] = await Promise.all(
      [
        this.db.kysely
          .selectFrom('data.contracts')
          .select((eb) => [
            eb.fn.countAll<number>().as('total_active'),
            eb.fn
              .count<number>(eb.case().when('counterparty', 'is not', null).then(eb.lit(1)).end())
              .as('with_counterparty'),
            eb.fn
              .count<number>(
                eb.case().when('expiration_date', '<=', quarterEndStr).then(eb.lit(1)).end()
              )
              .as('expiring_this_quarter'),
            eb.fn
              .count<number>(
                eb.case().when('notice_by_date', '<=', monthEndStr).then(eb.lit(1)).end()
              )
              .as('need_notice_this_month'),
          ])
          .where('org_id', '=', orgId)
          .executeTakeFirstOrThrow(),
        this.db.kysely
          .selectFrom('data.data_sources')
          .select((eb) => [
            eb.fn.countAll<number>().as('total'),
            eb.fn
              .count<number>(
                eb.case().when('status', 'in', ['UPLOADED', 'PROCESSING']).then(eb.lit(1)).end()
              )
              .as('processing'),
          ])
          .where('org_id', '=', orgId)
          .where('parent_data_source_id', 'is', null)
          .executeTakeFirstOrThrow(),
        this.db.kysely
          .selectFrom('data.contracts')
          .select((eb) => eb.fn.countAll<number>().as('total'))
          .where('org_id', '=', orgId)
          .executeTakeFirstOrThrow(),
        this.db.kysely
          .selectFrom('data.contracts')
          .selectAll()
          .where('org_id', '=', orgId)
          .orderBy(
            (eb) => eb.case().when('expiration_date', 'is', null).then(1).else(0).end(),
            'asc'
          )
          .orderBy('expiration_date', 'asc')
          .limit(options?.limit ?? 25)
          .offset(((options?.page ?? 1) - 1) * (options?.limit ?? 25))
          .execute(),
        this.db.kysely
          .selectFrom('data.contracts')
          .select((eb) => eb.fn.count<number>('counterparty').distinct().as('cnt'))
          .where('org_id', '=', orgId)
          .where('counterparty', 'is not', null)
          .executeTakeFirstOrThrow(),
      ]
    );

    const limit = options?.limit ?? 25;
    const page = options?.page ?? 1;

    return {
      metrics: {
        totalActive: Number(metrics.total_active),
        totalCounterparties: Number(counterpartiesResult.cnt),
        expiringThisQuarter: Number(metrics.expiring_this_quarter),
        needNoticeThisMonth: Number(metrics.need_notice_this_month),
        totalSources: Number(statusCounts.total),
        processingSources: Number(statusCounts.processing),
      },
      deadlines: contracts.map((c) => this.toResponse(c, now)),
      total: Number(totalResult.total),
      page,
      limit,
    };
  }

  async update(orgId: DbId<'Org'>, contractId: DbId<'Contract'>, data: { title?: string }) {
    if (data.title === undefined) return;

    const result = await this.db.kysely
      .updateTable('data.contracts')
      .set({ title: data.title, updated_at: new Date() })
      .where('id', '=', contractId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (result.numUpdatedRows === 0n) {
      throw new NotFoundException('Contract not found');
    }
  }

  async remove(orgId: DbId<'Org'>, contractId: DbId<'Contract'>) {
    const result = await this.db.kysely
      .deleteFrom('data.contracts')
      .where('id', '=', contractId)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    if (result.numDeletedRows === 0n) {
      throw new NotFoundException('Contract not found');
    }
  }

  private toResponse(
    c: {
      id: DbId<'Contract'>;
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
      total_value: string | null;
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
      extracted_at: Date | null;
      created_at: Date;
      updated_at: Date;
    },
    now: Date
  ) {
    let daysLeft: number | null = null;
    if (c.expiration_date) {
      const expDate = new Date(c.expiration_date);
      daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      id: c.id,
      orgId: c.org_id,
      dataSourceId: c.data_source_id,
      title: c.title,
      counterparty: c.counterparty,
      contractType: parseEnum<ContractType>(contractTypeEnum, c.contract_type),
      governingLaw: c.governing_law,
      jurisdiction: c.jurisdiction,
      effectiveDate: c.effective_date,
      expirationDate: c.expiration_date,
      executionDate: c.execution_date,
      renewalType: parseEnum<RenewalType>(renewalTypeEnum, c.renewal_type),
      renewalDate: c.renewal_date,
      renewalTermMonths: c.renewal_term_months,
      noticePeriodDays: c.notice_period_days,
      noticeByDate: c.notice_by_date,
      totalValue: c.total_value ? Number(c.total_value) : null,
      currency: c.currency,
      paymentTerms: c.payment_terms,
      paymentFrequency: parseEnum<PaymentFrequency>(paymentFrequencyEnum, c.payment_frequency),
      liabilityCapAmount: c.liability_cap_amount ? Number(c.liability_cap_amount) : null,
      liabilityCapType: parseEnum<LiabilityCapType>(liabilityCapTypeEnum, c.liability_cap_type),
      indemnificationType: parseEnum<IndemnificationType>(
        indemnificationTypeEnum,
        c.indemnification_type
      ),
      terminationForCause: c.termination_for_cause,
      terminationForConvenience: c.termination_for_convenience,
      terminationNoticeDays: c.termination_notice_days,
      ipOwnership: parseEnum<IpOwnership>(ipOwnershipEnum, c.ip_ownership),
      workForHire: c.work_for_hire,
      confidentialityTermMonths: c.confidentiality_term_months,
      nonCompete: c.non_compete,
      nonCompeteTermMonths: c.non_compete_term_months,
      nonSolicitation: c.non_solicitation,
      insuranceRequired: c.insurance_required,
      insuranceMinimumAmount: c.insurance_minimum_amount
        ? Number(c.insurance_minimum_amount)
        : null,
      disputeMechanism: parseEnum<DisputeMechanism>(disputeMechanismEnum, c.dispute_mechanism),
      disputeVenue: c.dispute_venue,
      extractionConfidence: c.extraction_confidence,
      extractedAt: c.extracted_at ? c.extracted_at.toISOString() : null,
      createdAt: c.created_at.toISOString(),
      updatedAt: c.updated_at.toISOString(),
      daysLeft,
    };
  }
}
