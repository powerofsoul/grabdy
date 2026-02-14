import { Controller } from '@nestjs/common';

import { usersContract } from '@grabdy/contracts';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

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
