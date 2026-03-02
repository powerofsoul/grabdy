import { Controller, NotFoundException, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { type DbId } from '@grabdy/common';
import { botsContract, type BotSourceConfig } from '@grabdy/contracts';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrgAccess } from '../../common/decorators/org-roles.decorator';

import { BotService } from './bot.service';

function extractBotSourceIds(config: BotSourceConfig): unknown[] {
  return config.map((s) => {
    switch (s.type) {
      case 'COLLECTION':
        return s.collectionId;
      case 'DATA_SOURCE':
        return s.dataSourceId;
      case 'CONNECTION':
      case 'CONNECTION_RESOURCE':
        return s.connectionId;
    }
  });
}

@Controller()
export class BotController {
  constructor(private botService: BotService) {}

  @OrgAccess(botsContract.create, {
    params: ['orgId'],
    body: (b) => extractBotSourceIds(b.dataSourceConfig ?? []),
  })
  @TsRestHandler(botsContract.create)
  async create(@CurrentUser('sub') userId: DbId<'User'>) {
    return tsRestHandler(botsContract.create, async ({ params, body }) => {
      const bot = await this.botService.create(params.orgId, userId, {
        name: body.name,
        dataSourceConfig: body.dataSourceConfig,
        systemPrompt: body.systemPrompt ?? null,
        title: body.title ?? null,
        subtitle: body.subtitle ?? null,
        placeholder: body.placeholder ?? null,
        accentColor: body.accentColor ?? null,
        primaryColor: body.primaryColor ?? null,
      });

      return {
        status: 200 as const,
        body: { success: true as const, data: bot },
      };
    });
  }

  @OrgAccess(botsContract.list, { params: ['orgId'] })
  @TsRestHandler(botsContract.list)
  async list() {
    return tsRestHandler(botsContract.list, async ({ params }) => {
      const bots = await this.botService.list(params.orgId);
      return {
        status: 200 as const,
        body: { success: true as const, data: bots },
      };
    });
  }

  @OrgAccess(botsContract.get, { params: ['orgId', 'botId'] })
  @TsRestHandler(botsContract.get)
  async get() {
    return tsRestHandler(botsContract.get, async ({ params }) => {
      const bot = await this.botService.get(params.orgId, params.botId);
      return {
        status: 200 as const,
        body: { success: true as const, data: bot },
      };
    });
  }

  @OrgAccess(botsContract.update, {
    params: ['orgId', 'botId'],
    body: (b) => extractBotSourceIds(b.dataSourceConfig ?? []),
  })
  @TsRestHandler(botsContract.update)
  async update() {
    return tsRestHandler(botsContract.update, async ({ params, body }) => {
      const bot = await this.botService.update(params.orgId, params.botId, {
        name: body.name,
        dataSourceConfig: body.dataSourceConfig,
        systemPrompt: body.systemPrompt,
        title: body.title,
        subtitle: body.subtitle,
        placeholder: body.placeholder,
        accentColor: body.accentColor,
        primaryColor: body.primaryColor,
      });

      return {
        status: 200 as const,
        body: { success: true as const, data: bot },
      };
    });
  }

  @OrgAccess(botsContract.delete, { params: ['orgId', 'botId'] })
  @TsRestHandler(botsContract.delete)
  async delete() {
    return tsRestHandler(botsContract.delete, async ({ params }) => {
      try {
        await this.botService.delete(params.orgId, params.botId);
        return {
          status: 200 as const,
          body: { success: true as const },
        };
      } catch (error) {
        if (error instanceof NotFoundException) {
          return {
            status: 404 as const,
            body: { success: false as const, error: 'Bot not found' },
          };
        }
        throw error;
      }
    });
  }

  @OrgAccess(botsContract.uploadImage, { params: ['orgId', 'botId'] })
  @TsRestHandler(botsContract.uploadImage)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    return tsRestHandler(botsContract.uploadImage, async ({ params }) => {
      if (!file) {
        return {
          status: 400 as const,
          body: { success: false as const, error: 'No file provided' },
        };
      }

      const imageUrl = await this.botService.uploadImage(params.orgId, params.botId, file);

      return {
        status: 200 as const,
        body: { success: true as const, data: { imageUrl } },
      };
    });
  }

  @OrgAccess(botsContract.deleteImage, { params: ['orgId', 'botId'] })
  @TsRestHandler(botsContract.deleteImage)
  async deleteImage() {
    return tsRestHandler(botsContract.deleteImage, async ({ params }) => {
      try {
        await this.botService.deleteImage(params.orgId, params.botId);
        return {
          status: 200 as const,
          body: { success: true as const },
        };
      } catch (error) {
        if (error instanceof NotFoundException) {
          return {
            status: 404 as const,
            body: { success: false as const, error: 'Bot not found' },
          };
        }
        throw error;
      }
    });
  }

  @OrgAccess(botsContract.generateSigningKey, {
    roles: ['OWNER', 'ADMIN'],
    params: ['orgId', 'botId'],
  })
  @TsRestHandler(botsContract.generateSigningKey)
  async generateSigningKey(@CurrentUser('sub') userId: DbId<'User'>) {
    return tsRestHandler(botsContract.generateSigningKey, async ({ params, body }) => {
      const key = await this.botService.generateSigningKey(
        params.orgId,
        params.botId,
        userId,
        body.name
      );

      return {
        status: 200 as const,
        body: { success: true as const, data: key },
      };
    });
  }

  @OrgAccess(botsContract.listSigningKeys, { params: ['orgId', 'botId'] })
  @TsRestHandler(botsContract.listSigningKeys)
  async listSigningKeys() {
    return tsRestHandler(botsContract.listSigningKeys, async ({ params }) => {
      const keys = await this.botService.listSigningKeys(params.orgId, params.botId);
      return {
        status: 200 as const,
        body: { success: true as const, data: keys },
      };
    });
  }

  @OrgAccess(botsContract.revokeSigningKey, {
    roles: ['OWNER', 'ADMIN'],
    params: ['orgId', 'botId', 'keyId'],
  })
  @TsRestHandler(botsContract.revokeSigningKey)
  async revokeSigningKey() {
    return tsRestHandler(botsContract.revokeSigningKey, async ({ params }) => {
      await this.botService.revokeSigningKey(params.orgId, params.botId, params.keyId);
      return {
        status: 200 as const,
        body: { success: true as const },
      };
    });
  }
}
