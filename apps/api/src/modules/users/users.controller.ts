import { Controller } from '@nestjs/common';

import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

import { usersContract } from '@fastdex/contracts';

import { OrgAccess } from '../../common/decorators/org-roles.decorator';

import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @OrgAccess(usersContract.list, { params: ['orgId'] })
  @TsRestHandler(usersContract.list)
  async list() {
    return tsRestHandler(usersContract.list, async ({ params }) => {
      const members = await this.usersService.listMembers(params.orgId);
      return {
        status: 200 as const,
        body: {
          success: true as const,
          data: members.map((m) => ({
            ...m,
            createdAt: m.createdAt.toISOString(),
          })),
        },
      };
    });
  }
}
