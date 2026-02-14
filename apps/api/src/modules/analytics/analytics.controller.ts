import { Controller } from '@nestjs/common';

import { analyticsContract } from '@grabdy/contracts';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

import { OrgAccess } from '../../common/decorators/org-roles.decorator';

import { AnalyticsService } from './analytics.service';

@Controller()
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @OrgAccess(analyticsContract.getUsageSummary, { params: ['orgId'] })
  @TsRestHandler(analyticsContract.getUsageSummary)
  async getUsageSummary() {
    return tsRestHandler(analyticsContract.getUsageSummary, async ({ params, query }) => {
      const data = await this.analyticsService.getUsageSummary(params.orgId, query.days);

      return {
        status: 200 as const,
        body: { success: true as const, data },
      };
    });
  }
}
