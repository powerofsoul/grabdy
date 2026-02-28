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

    const [summary, daily, byMember, bySource] = await Promise.all([
      this.getSummary(orgId, since),
      this.getDailyUsage(orgId, since),
      this.getMemberBreakdown(orgId, since),
      this.getSourceBreakdown(orgId, since),
    ]);

    return { summary, daily, byMember, bySource };
  }

  async getGlobalUsageWithCost(days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [summary, byOrg, byModel] = await Promise.all([
      this.getGlobalSummaryWithCost(since),
      this.getOrgBreakdownWithCost(since),
      this.getGlobalModelBreakdownWithCost(since),
    ]);

    return { summary, byOrg, byModel };
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

  private async getGlobalSummaryWithCost(since: Date) {
    // org-safe: admin-only global aggregation across all orgs
    const result = await this.db.kysely
      .selectFrom('analytics.ai_usage_logs')
      .select([
        sql<number>`count(*)::int`.as('total_requests'),
        sql<number>`coalesce(sum(input_tokens), 0)::int`.as('total_input_tokens'),
        sql<number>`coalesce(sum(output_tokens), 0)::int`.as('total_output_tokens'),
        sql<number>`coalesce(sum(total_tokens), 0)::int`.as('total_tokens'),
        sql<string>`coalesce(sum(cost), 0)`.as('total_cost'),
      ])
      .where('created_at', '>=', since)
      .executeTakeFirstOrThrow();

    return {
      totalRequests: Number(result.total_requests),
      totalInputTokens: Number(result.total_input_tokens),
      totalOutputTokens: Number(result.total_output_tokens),
      totalTokens: Number(result.total_tokens),
      totalCost: Number(result.total_cost),
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

  private async getMemberBreakdown(orgId: DbId<'Org'>, since: Date) {
    const results = await this.db.kysely
      .selectFrom('analytics.ai_usage_logs')
      .leftJoin('auth.users', 'auth.users.id', 'analytics.ai_usage_logs.user_id')
      .select([
        'analytics.ai_usage_logs.user_id',
        sql<string>`coalesce(trim(auth.users.first_name || ' ' || auth.users.last_name), 'System')`.as(
          'user_name'
        ),
        sql<number>`count(*)::int`.as('requests'),
        sql<number>`coalesce(sum(analytics.ai_usage_logs.input_tokens), 0)::int`.as('input_tokens'),
        sql<number>`coalesce(sum(analytics.ai_usage_logs.output_tokens), 0)::int`.as(
          'output_tokens'
        ),
        sql<number>`coalesce(sum(analytics.ai_usage_logs.total_tokens), 0)::int`.as('total_tokens'),
      ])
      .where('analytics.ai_usage_logs.org_id', '=', orgId)
      .where('analytics.ai_usage_logs.created_at', '>=', since)
      .groupBy(['analytics.ai_usage_logs.user_id', 'auth.users.first_name', 'auth.users.last_name'])
      .orderBy(sql`sum(analytics.ai_usage_logs.total_tokens)`, 'desc')
      .execute();

    return results.map((r) => ({
      userId: r.user_id,
      userName: r.user_name,
      requests: Number(r.requests),
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
      totalTokens: Number(r.total_tokens),
    }));
  }

  private async getSourceBreakdown(orgId: DbId<'Org'>, since: Date) {
    const results = await this.db.kysely
      .selectFrom('analytics.ai_usage_logs')
      .select([
        'source',
        sql<number>`count(*)::int`.as('requests'),
        sql<number>`coalesce(sum(input_tokens), 0)::int`.as('input_tokens'),
        sql<number>`coalesce(sum(output_tokens), 0)::int`.as('output_tokens'),
        sql<number>`coalesce(sum(total_tokens), 0)::int`.as('total_tokens'),
      ])
      .where('org_id', '=', orgId)
      .where('created_at', '>=', since)
      .groupBy('source')
      .orderBy(sql`sum(total_tokens)`, 'desc')
      .execute();

    return results.map((r) => ({
      source: r.source,
      requests: Number(r.requests),
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
      totalTokens: Number(r.total_tokens),
    }));
  }

  private async getOrgBreakdownWithCost(since: Date) {
    // org-safe: admin-only per-org cost breakdown
    const results = await this.db.kysely
      .selectFrom('analytics.ai_usage_logs')
      .innerJoin('org.orgs', 'org.orgs.id', 'analytics.ai_usage_logs.org_id')
      .select([
        'analytics.ai_usage_logs.org_id',
        'org.orgs.name as org_name',
        sql<number>`count(*)::int`.as('requests'),
        sql<number>`coalesce(sum(analytics.ai_usage_logs.input_tokens), 0)::int`.as('input_tokens'),
        sql<number>`coalesce(sum(analytics.ai_usage_logs.output_tokens), 0)::int`.as(
          'output_tokens'
        ),
        sql<number>`coalesce(sum(analytics.ai_usage_logs.total_tokens), 0)::int`.as('total_tokens'),
        sql<string>`coalesce(sum(analytics.ai_usage_logs.cost), 0)`.as('cost'),
      ])
      .where('analytics.ai_usage_logs.created_at', '>=', since)
      .groupBy(['analytics.ai_usage_logs.org_id', 'org.orgs.name'])
      .orderBy(sql`sum(analytics.ai_usage_logs.cost)`, 'desc')
      .execute();

    return results.map((r) => ({
      orgId: r.org_id,
      orgName: r.org_name,
      requests: Number(r.requests),
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
      totalTokens: Number(r.total_tokens),
      cost: Number(r.cost),
    }));
  }

  private async getGlobalModelBreakdownWithCost(since: Date) {
    // org-safe: admin-only global model cost breakdown
    const results = await this.db.kysely
      .selectFrom('analytics.ai_usage_logs')
      .select([
        'model',
        'provider',
        sql<number>`count(*)::int`.as('requests'),
        sql<number>`coalesce(sum(input_tokens), 0)::int`.as('input_tokens'),
        sql<number>`coalesce(sum(output_tokens), 0)::int`.as('output_tokens'),
        sql<number>`coalesce(sum(total_tokens), 0)::int`.as('total_tokens'),
        sql<string>`coalesce(sum(cost), 0)`.as('cost'),
      ])
      .where('created_at', '>=', since)
      .groupBy(['model', 'provider'])
      .orderBy(sql`sum(cost)`, 'desc')
      .execute();

    return results.map((r) => ({
      model: r.model,
      provider: r.provider,
      requests: Number(r.requests),
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
      totalTokens: Number(r.total_tokens),
      cost: Number(r.cost),
    }));
  }
}
