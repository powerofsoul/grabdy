import { Controller } from '@nestjs/common';

import { billingContract } from '@grabdy/contracts';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

import { OrgAccess } from '../../common/decorators/org-roles.decorator';

import { BillingService } from './billing.service';

@Controller()
export class BillingController {
  constructor(private billingService: BillingService) {}

  @OrgAccess(billingContract.getStatus, { params: ['orgId'] })
  @TsRestHandler(billingContract.getStatus)
  async getStatus() {
    return tsRestHandler(billingContract.getStatus, async ({ params }) => {
      const data = await this.billingService.getBillingStatus(params.orgId);
      return {
        status: 200 as const,
        body: { success: true as const, data },
      };
    });
  }

  @OrgAccess(billingContract.createPortalSession, {
    roles: ['OWNER', 'ADMIN'],
    params: ['orgId'],
  })
  @TsRestHandler(billingContract.createPortalSession)
  async createPortalSession() {
    return tsRestHandler(billingContract.createPortalSession, async ({ params, body }) => {
      const url = await this.billingService.createPortalSession(params.orgId, body.returnUrl);
      return {
        status: 200 as const,
        body: { success: true as const, data: { url } },
      };
    });
  }
}
