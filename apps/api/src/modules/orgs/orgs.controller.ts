import { Controller } from '@nestjs/common';

import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

import { orgsContract } from '@grabdy/contracts';

import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { OrgAccess } from '../../common/decorators/org-roles.decorator';

import { OrgsService } from './orgs.service';

function toISOString(date: Date): string {
  return date.toISOString();
}

@Controller()
export class OrgsController {
  constructor(private orgsService: OrgsService) {}

  @TsRestHandler(orgsContract.create)
  async create(@CurrentUser() user: JwtPayload) {
    return tsRestHandler(orgsContract.create, async ({ body }) => {
      try {
        const org = await this.orgsService.create(body, user.sub);
        return {
          status: 200 as const,
          body: {
            success: true as const,
            data: {
              id: org.id,
              name: org.name,
              createdAt: toISOString(org.createdAt),
              updatedAt: toISOString(org.updatedAt),
            },
          },
        };
      } catch (error) {
        return {
          status: 400 as const,
          body: {
            success: false as const,
            error: error instanceof Error ? error.message : 'Failed to create organization',
          },
        };
      }
    });
  }

  @OrgAccess(orgsContract.get, { params: ['orgId'] })
  @TsRestHandler(orgsContract.get)
  async get() {
    return tsRestHandler(orgsContract.get, async ({ params }) => {
      try {
        const org = await this.orgsService.findById(params.orgId);
        return {
          status: 200 as const,
          body: {
            success: true as const,
            data: {
              id: org.id,
              name: org.name,
              createdAt: toISOString(org.createdAt),
              updatedAt: toISOString(org.updatedAt),
            },
          },
        };
      } catch {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Organization not found' },
        };
      }
    });
  }

  @OrgAccess(orgsContract.update, { roles: ['OWNER', 'ADMIN'], params: ['orgId'] })
  @TsRestHandler(orgsContract.update)
  async update() {
    return tsRestHandler(orgsContract.update, async ({ params, body }) => {
      try {
        const org = await this.orgsService.update(params.orgId, body);
        return {
          status: 200 as const,
          body: {
            success: true as const,
            data: {
              id: org.id,
              name: org.name,
              createdAt: toISOString(org.createdAt),
              updatedAt: toISOString(org.updatedAt),
            },
          },
        };
      } catch (error) {
        return {
          status: 400 as const,
          body: {
            success: false as const,
            error: error instanceof Error ? error.message : 'Failed to update organization',
          },
        };
      }
    });
  }

  @OrgAccess(orgsContract.invite, { roles: ['OWNER', 'ADMIN'], params: ['orgId'] })
  @TsRestHandler(orgsContract.invite)
  async invite() {
    return tsRestHandler(orgsContract.invite, async ({ params, body }) => {
      try {
        const result = await this.orgsService.inviteMember(params.orgId, body);
        return {
          status: 200 as const,
          body: {
            success: true as const,
            data: {
              id: result.id,
              email: result.email,
              name: result.name,
              roles: result.roles,
              expiresAt: result.expiresAt ? toISOString(result.expiresAt) : null,
              createdAt: toISOString(result.createdAt),
            },
          },
        };
      } catch (error) {
        return {
          status: 400 as const,
          body: {
            success: false as const,
            error: error instanceof Error ? error.message : 'Failed to invite member',
          },
        };
      }
    });
  }

  @OrgAccess(orgsContract.listMembers, { params: ['orgId'] })
  @TsRestHandler(orgsContract.listMembers)
  async listMembers() {
    return tsRestHandler(orgsContract.listMembers, async ({ params }) => {
      const members = await this.orgsService.getMembers(params.orgId);
      return {
        status: 200 as const,
        body: {
          success: true as const,
          data: members.map((m) => ({
            id: m.id,
            userId: m.userId,
            orgId: m.orgId,
            roles: m.roles,
            email: m.email,
            name: m.name,
            createdAt: toISOString(m.createdAt),
          })),
        },
      };
    });
  }

  @OrgAccess(orgsContract.removeMember, { roles: ['OWNER', 'ADMIN'], params: ['orgId', 'memberId'] })
  @TsRestHandler(orgsContract.removeMember)
  async removeMember() {
    return tsRestHandler(orgsContract.removeMember, async ({ params }) => {
      try {
        await this.orgsService.removeMember(params.orgId, params.memberId);
        return {
          status: 200 as const,
          body: { success: true as const },
        };
      } catch (error) {
        return {
          status: 400 as const,
          body: {
            success: false as const,
            error: error instanceof Error ? error.message : 'Failed to remove member',
          },
        };
      }
    });
  }
}
