import { Controller } from '@nestjs/common';

import { contractsContract } from '@grabdy/contracts';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

import { OrgAccess } from '../../common/decorators/org-roles.decorator';

import { ContractsService } from './contracts.service';

@Controller()
export class ContractsController {
  constructor(private contractsService: ContractsService) {}

  @OrgAccess(contractsContract.list, { params: ['orgId'] })
  @TsRestHandler(contractsContract.list)
  async list() {
    return tsRestHandler(contractsContract.list, async ({ params, query }) => {
      const data = await this.contractsService.list(params.orgId, {
        search: query.search,
        counterparty: query.counterparty,
        contractType: query.contractType,
        renewalType: query.renewalType,
        status: query.status,
        expiringBefore: query.expiringBefore,
        expiringAfter: query.expiringAfter,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        limit: query.limit,
        page: query.page,
      });
      return {
        status: 200 as const,
        body: { success: true as const, data },
      };
    });
  }

  // deadlines must be registered before get, otherwise /contracts/deadlines
  // matches /contracts/:contractId with contractId='deadlines'
  @OrgAccess(contractsContract.deadlines, { params: ['orgId'] })
  @TsRestHandler(contractsContract.deadlines)
  async deadlines() {
    return tsRestHandler(contractsContract.deadlines, async ({ params, query }) => {
      const data = await this.contractsService.deadlines(params.orgId, {
        limit: query.limit,
        page: query.page,
      });
      return {
        status: 200 as const,
        body: { success: true as const, data },
      };
    });
  }

  @OrgAccess(contractsContract.get, { params: ['orgId', 'contractId'] })
  @TsRestHandler(contractsContract.get)
  async get() {
    return tsRestHandler(contractsContract.get, async ({ params }) => {
      const data = await this.contractsService.findById(params.orgId, params.contractId);
      return {
        status: 200 as const,
        body: { success: true as const, data },
      };
    });
  }

  @OrgAccess(contractsContract.update, {
    roles: ['OWNER', 'ADMIN'],
    params: ['orgId', 'contractId'],
  })
  @TsRestHandler(contractsContract.update)
  async update() {
    return tsRestHandler(contractsContract.update, async ({ params, body }) => {
      await this.contractsService.update(params.orgId, params.contractId, body);
      return {
        status: 200 as const,
        body: { success: true as const },
      };
    });
  }

  @OrgAccess(contractsContract.remove, {
    roles: ['OWNER', 'ADMIN'],
    params: ['orgId', 'contractId'],
  })
  @TsRestHandler(contractsContract.remove)
  async remove() {
    return tsRestHandler(contractsContract.remove, async ({ params }) => {
      await this.contractsService.remove(params.orgId, params.contractId);
      return {
        status: 200 as const,
        body: { success: true as const },
      };
    });
  }
}
