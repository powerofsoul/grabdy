import { Controller, NotFoundException } from '@nestjs/common';

import { type DbId } from '@grabdy/common';
import { sdkChatsContract } from '@grabdy/contracts';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrgAccess } from '../../common/decorators/org-roles.decorator';

import { SdkChatService } from './sdk-chat.service';

@Controller()
export class SdkChatController {
  constructor(private sdkChatService: SdkChatService) {}

  @OrgAccess(sdkChatsContract.create, { params: ['orgId'] })
  @TsRestHandler(sdkChatsContract.create)
  async create(@CurrentUser('sub') userId: DbId<'User'>) {
    return tsRestHandler(sdkChatsContract.create, async ({ params, body }) => {
      try {
        const sdkChat = await this.sdkChatService.create(params.orgId, userId, {
          name: body.name,
          dataSourceConfig: body.dataSourceConfig,
          systemPrompt: body.systemPrompt ?? null,
        });

        return {
          status: 200 as const,
          body: { success: true as const, data: sdkChat },
        };
      } catch (error) {
        return {
          status: 400 as const,
          body: {
            success: false as const,
            error: error instanceof Error ? error.message : 'Failed to create SDK Chat',
          },
        };
      }
    });
  }

  @OrgAccess(sdkChatsContract.list, { params: ['orgId'] })
  @TsRestHandler(sdkChatsContract.list)
  async list() {
    return tsRestHandler(sdkChatsContract.list, async ({ params }) => {
      const sdkChats = await this.sdkChatService.list(params.orgId);
      return {
        status: 200 as const,
        body: { success: true as const, data: sdkChats },
      };
    });
  }

  @OrgAccess(sdkChatsContract.get, { params: ['orgId', 'sdkChatId'] })
  @TsRestHandler(sdkChatsContract.get)
  async get() {
    return tsRestHandler(sdkChatsContract.get, async ({ params }) => {
      try {
        const sdkChat = await this.sdkChatService.get(params.orgId, params.sdkChatId);
        return {
          status: 200 as const,
          body: { success: true as const, data: sdkChat },
        };
      } catch {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'SDK Chat not found' },
        };
      }
    });
  }

  @OrgAccess(sdkChatsContract.update, { params: ['orgId', 'sdkChatId'] })
  @TsRestHandler(sdkChatsContract.update)
  async update() {
    return tsRestHandler(sdkChatsContract.update, async ({ params, body }) => {
      try {
        const sdkChat = await this.sdkChatService.update(params.orgId, params.sdkChatId, {
          name: body.name,
          dataSourceConfig: body.dataSourceConfig,
          systemPrompt: body.systemPrompt,
          isActive: body.isActive,
        });

        return {
          status: 200 as const,
          body: { success: true as const, data: sdkChat },
        };
      } catch {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'SDK Chat not found' },
        };
      }
    });
  }

  @OrgAccess(sdkChatsContract.delete, { params: ['orgId', 'sdkChatId'] })
  @TsRestHandler(sdkChatsContract.delete)
  async delete() {
    return tsRestHandler(sdkChatsContract.delete, async ({ params }) => {
      try {
        await this.sdkChatService.delete(params.orgId, params.sdkChatId);
        return {
          status: 200 as const,
          body: { success: true as const },
        };
      } catch (error) {
        if (error instanceof NotFoundException) {
          return {
            status: 404 as const,
            body: { success: false as const, error: 'SDK Chat not found' },
          };
        }
        throw error;
      }
    });
  }

  @OrgAccess(sdkChatsContract.generateSigningKey, {
    roles: ['OWNER', 'ADMIN'],
    params: ['orgId', 'sdkChatId'],
  })
  @TsRestHandler(sdkChatsContract.generateSigningKey)
  async generateSigningKey(@CurrentUser('sub') userId: DbId<'User'>) {
    return tsRestHandler(sdkChatsContract.generateSigningKey, async ({ params, body }) => {
      try {
        const key = await this.sdkChatService.generateSigningKey(
          params.orgId,
          params.sdkChatId,
          userId,
          body.name
        );

        return {
          status: 200 as const,
          body: { success: true as const, data: key },
        };
      } catch (error) {
        if (error instanceof Error && error.message === 'SDK Chat not found') {
          return {
            status: 404 as const,
            body: { success: false as const, error: 'SDK Chat not found' },
          };
        }
        return {
          status: 400 as const,
          body: {
            success: false as const,
            error: error instanceof Error ? error.message : 'Failed to generate signing key',
          },
        };
      }
    });
  }

  @OrgAccess(sdkChatsContract.listSigningKeys, { params: ['orgId', 'sdkChatId'] })
  @TsRestHandler(sdkChatsContract.listSigningKeys)
  async listSigningKeys() {
    return tsRestHandler(sdkChatsContract.listSigningKeys, async ({ params }) => {
      const keys = await this.sdkChatService.listSigningKeys(params.orgId, params.sdkChatId);
      return {
        status: 200 as const,
        body: { success: true as const, data: keys },
      };
    });
  }

  @OrgAccess(sdkChatsContract.revokeSigningKey, {
    roles: ['OWNER', 'ADMIN'],
    params: ['orgId', 'sdkChatId', 'keyId'],
  })
  @TsRestHandler(sdkChatsContract.revokeSigningKey)
  async revokeSigningKey() {
    return tsRestHandler(sdkChatsContract.revokeSigningKey, async ({ params }) => {
      try {
        await this.sdkChatService.revokeSigningKey(params.orgId, params.sdkChatId, params.keyId);
        return {
          status: 200 as const,
          body: { success: true as const },
        };
      } catch {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Signing key not found' },
        };
      }
    });
  }

  @OrgAccess(sdkChatsContract.generatePreviewJwt, { params: ['orgId', 'sdkChatId'] })
  @TsRestHandler(sdkChatsContract.generatePreviewJwt)
  async generatePreviewJwt(@CurrentUser('sub') userId: DbId<'User'>) {
    return tsRestHandler(sdkChatsContract.generatePreviewJwt, async ({ params }) => {
      try {
        const jwt = await this.sdkChatService.generatePreviewJwt(
          params.orgId,
          params.sdkChatId,
          userId
        );
        return {
          status: 200 as const,
          body: { success: true as const, data: { jwt } },
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return {
            status: 404 as const,
            body: { success: false as const, error: error.message },
          };
        }
        return {
          status: 400 as const,
          body: {
            success: false as const,
            error: error instanceof Error ? error.message : 'Failed to generate preview JWT',
          },
        };
      }
    });
  }
}
