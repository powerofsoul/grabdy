import { Controller } from '@nestjs/common';

import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

import { apiKeysContract } from '@fastdex/contracts';

import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { OrgAccess } from '../../common/decorators/org-roles.decorator';

import { ApiKeysService } from './api-keys.service';

function toISOStringOrNull(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

@Controller()
export class ApiKeysController {
  constructor(private apiKeysService: ApiKeysService) {}

  @OrgAccess(apiKeysContract.create, { roles: ['OWNER', 'ADMIN'], params: ['orgId'] })
  @TsRestHandler(apiKeysContract.create)
  async create(@CurrentUser() user: JwtPayload) {
    return tsRestHandler(apiKeysContract.create, async ({ params, body }) => {
      try {
        const apiKey = await this.apiKeysService.create(params.orgId, user.sub, body.name);
        return {
          status: 200 as const,
          body: {
            success: true as const,
            data: {
              id: apiKey.id,
              name: apiKey.name,
              keyPrefix: apiKey.keyPrefix,
              key: apiKey.key,
              lastUsedAt: toISOStringOrNull(apiKey.lastUsedAt),
              revokedAt: toISOStringOrNull(apiKey.revokedAt),
              createdAt: apiKey.createdAt.toISOString(),
            },
          },
        };
      } catch (error) {
        return {
          status: 400 as const,
          body: {
            success: false as const,
            error: error instanceof Error ? error.message : 'Failed to create API key',
          },
        };
      }
    });
  }

  @OrgAccess(apiKeysContract.list, { params: ['orgId'] })
  @TsRestHandler(apiKeysContract.list)
  async list() {
    return tsRestHandler(apiKeysContract.list, async ({ params }) => {
      const keys = await this.apiKeysService.list(params.orgId);
      return {
        status: 200 as const,
        body: {
          success: true as const,
          data: keys.map((k) => ({
            id: k.id,
            name: k.name,
            keyPrefix: k.keyPrefix,
            lastUsedAt: toISOStringOrNull(k.lastUsedAt),
            revokedAt: toISOStringOrNull(k.revokedAt),
            createdAt: k.createdAt.toISOString(),
          })),
        },
      };
    });
  }

  @OrgAccess(apiKeysContract.revoke, { roles: ['OWNER', 'ADMIN'], params: ['orgId', 'keyId'] })
  @TsRestHandler(apiKeysContract.revoke)
  async revoke() {
    return tsRestHandler(apiKeysContract.revoke, async ({ params }) => {
      try {
        await this.apiKeysService.revoke(params.orgId, params.keyId);
        return {
          status: 200 as const,
          body: { success: true as const },
        };
      } catch {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'API key not found' },
        };
      }
    });
  }
}
