import { Injectable } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { sql } from 'kysely';

import { DbService } from '../../db/db.module';

@Injectable()
export class AnalyticsService {
  constructor(private db: DbService) {}

  async getUsageSummary(orgId: DbId<'Org'>, days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [summary, daily, byModel, byRequestType] = await Promise.all([
      this.getSummary(orgId, since),
      this.getDailyUsage(orgId, since),
      this.getModelBreakdown(orgId, since),
      this.getRequestTypeBreakdown(orgId, since),
    ]);

    return { summary, daily, byModel, byRequestType };
  }

  private async getSummary(orgId: DbId<'Org'>, since: Date) {
    const result = await this.db.kysely
      .selectFrom('analytics.ai_usage_logs')
      .select([
        sql<number>`count(*)::int`.as('total_requests'),
        sql<number>`coalesce(sum(input_tokens), 0)::int`.as('total_input_tokens'),
        sql<number>`coalesce(sum(output_tokens), 0)::int`.as('total_output_tokens'),
        sql<number>`coalesce(sum(total_tokens), 0)::int`.as('total_tokens'),
      ])
      .where('org_id', '=', orgId)
      .where('created_at', '>=', since)
      .executeTakeFirstOrThrow();

    return {
      totalRequests: Number(result.total_requests),
      totalInputTokens: Number(result.total_input_tokens),
      totalOutputTokens: Number(result.total_output_tokens),
      totalTokens: Number(result.total_tokens),
    };
  }

  private async getDailyUsage(orgId: DbId<'Org'>, since: Date) {
    const results = await this.db.kysely
      .selectFrom('analytics.ai_usage_logs')
      .select([
        sql<string>`date_trunc('day', created_at)::date::text`.as('date'),
        sql<number>`count(*)::int`.as('requests'),
        sql<number>`coalesce(sum(input_tokens), 0)::int`.as('input_tokens'),
        sql<number>`coalesce(sum(output_tokens), 0)::int`.as('output_tokens'),
        sql<number>`coalesce(sum(total_tokens), 0)::int`.as('total_tokens'),
      ])
      .where('org_id', '=', orgId)
      .where('created_at', '>=', since)
      .groupBy(sql`date_trunc('day', created_at)`)
      .orderBy('date', 'asc')
      .execute();

    return results.map((r) => ({
      date: r.date,
      requests: Number(r.requests),
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
      totalTokens: Number(r.total_tokens),
    }));
  }

  private async getModelBreakdown(orgId: DbId<'Org'>, since: Date) {
    const results = await this.db.kysely
      .selectFrom('analytics.ai_usage_logs')
      .select([
        'model',
        'provider',
        sql<number>`count(*)::int`.as('requests'),
        sql<number>`coalesce(sum(input_tokens), 0)::int`.as('input_tokens'),
        sql<number>`coalesce(sum(output_tokens), 0)::int`.as('output_tokens'),
        sql<number>`coalesce(sum(total_tokens), 0)::int`.as('total_tokens'),
      ])
      .where('org_id', '=', orgId)
      .where('created_at', '>=', since)
      .groupBy(['model', 'provider'])
      .orderBy(sql`sum(total_tokens)`, 'desc')
      .execute();

    return results.map((r) => ({
      model: r.model,
      provider: r.provider,
      requests: Number(r.requests),
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
      totalTokens: Number(r.total_tokens),
    }));
  }

  private async getRequestTypeBreakdown(orgId: DbId<'Org'>, since: Date) {
    const results = await this.db.kysely
      .selectFrom('analytics.ai_usage_logs')
      .select([
        'request_type',
        sql<number>`count(*)::int`.as('requests'),
        sql<number>`coalesce(sum(total_tokens), 0)::int`.as('total_tokens'),
      ])
      .where('org_id', '=', orgId)
      .where('created_at', '>=', since)
      .groupBy('request_type')
      .orderBy(sql`sum(total_tokens)`, 'desc')
      .execute();

    return results.map((r) => ({
      requestType: r.request_type,
      requests: Number(r.requests),
      totalTokens: Number(r.total_tokens),
    }));
  }
}
