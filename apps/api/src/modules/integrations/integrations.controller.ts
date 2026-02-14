import { Controller, Get, Inject, Logger, Param, Post, Query, Req, Res } from '@nestjs/common';

import { dbIdSchema } from '@grabdy/common';
import { integrationProviderEnum,integrationsContract } from '@grabdy/contracts';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import type Redis from 'ioredis';

import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { OrgAccess } from '../../common/decorators/org-roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { InjectEnv } from '../../config/env.config';

import { ProviderRegistry } from './providers/provider-registry';
import { INTEGRATIONS_REDIS } from './integrations.constants';
import { IntegrationsService } from './integrations.service';

interface OAuthState {
  org: string;
  user: string;
  provider: string;
}

const OAUTH_STATE_TTL_SECONDS = 600; // 10 minutes
const OAUTH_STATE_PREFIX = 'oauth_state:';

function toISOStringOrNull(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date instanceof Date ? date.toISOString() : String(date);
}

function toISOString(date: Date): string {
  return date instanceof Date ? date.toISOString() : String(date);
}

@Controller()
export class IntegrationsController {
  private readonly logger = new Logger(IntegrationsController.name);

  constructor(
    private integrationsService: IntegrationsService,
    private providerRegistry: ProviderRegistry,
    @Inject(INTEGRATIONS_REDIS) private readonly redis: Redis,
    @InjectEnv('frontendUrl') private readonly frontendUrl: string,
  ) {}

  @OrgAccess(integrationsContract.listConnections, { params: ['orgId'] })
  @TsRestHandler(integrationsContract.listConnections)
  async listConnections() {
    return tsRestHandler(integrationsContract.listConnections, async ({ params }) => {
      const connections = await this.integrationsService.listConnections(params.orgId);
      return {
        status: 200 as const,
        body: {
          success: true as const,
          data: connections.map((c) => ({
            ...c,
            lastSyncedAt: toISOStringOrNull(c.lastSyncedAt),
            createdAt: toISOString(c.createdAt),
            updatedAt: toISOString(c.updatedAt),
          })),
        },
      };
    });
  }

  @OrgAccess(integrationsContract.connect, { params: ['orgId'] })
  @TsRestHandler(integrationsContract.connect)
  async connect(@CurrentUser() user: JwtPayload) {
    return tsRestHandler(integrationsContract.connect, async ({ params }) => {
      const provider = params.provider;

      if (!this.providerRegistry.hasConnector(provider)) {
        return {
          status: 400 as const,
          body: { success: false as const, error: `Provider ${provider} is not yet supported` },
        };
      }

      const connector = this.providerRegistry.getConnector(provider);

      // Generate OAuth state token and store in Redis with TTL
      const state = randomBytes(32).toString('hex');
      const stateData: OAuthState = {
        org: params.orgId,
        user: user.sub,
        provider,
      };
      await this.redis.set(
        `${OAUTH_STATE_PREFIX}${state}`,
        JSON.stringify(stateData),
        'EX',
        OAUTH_STATE_TTL_SECONDS,
      );

      const redirectUri = `${this.frontendUrl}/api/integrations/callback`;
      const redirectUrl = connector.getAuthUrl(params.orgId, state, redirectUri);

      return {
        status: 200 as const,
        body: {
          success: true as const,
          data: { redirectUrl },
        },
      };
    });
  }

  @OrgAccess(integrationsContract.disconnect, { params: ['orgId'] })
  @TsRestHandler(integrationsContract.disconnect)
  async disconnect() {
    return tsRestHandler(integrationsContract.disconnect, async ({ params }) => {
      const success = await this.integrationsService.disconnect(params.orgId, params.provider);

      if (!success) {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Connection not found' },
        };
      }

      return {
        status: 200 as const,
        body: { success: true as const },
      };
    });
  }

  @OrgAccess(integrationsContract.updateConfig, { params: ['orgId'] })
  @TsRestHandler(integrationsContract.updateConfig)
  async updateConfig() {
    return tsRestHandler(integrationsContract.updateConfig, async ({ params, body }) => {
      const connection = await this.integrationsService.getConnectionMeta(params.orgId, params.provider);
      if (!connection) {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Connection not found' },
        };
      }

      await this.integrationsService.updateConnection(connection.id, {
        syncEnabled: body.syncEnabled,
        syncIntervalMinutes: body.syncIntervalMinutes,
        config: body.config,
      });

      const updated = await this.integrationsService.getConnectionMeta(params.orgId, params.provider);
      if (!updated) {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Connection not found' },
        };
      }

      return {
        status: 200 as const,
        body: {
          success: true as const,
          data: {
            id: updated.id,
            provider: updated.provider,
            status: updated.status,
            externalAccountId: updated.external_account_id,
            externalAccountName: updated.external_account_name,
            lastSyncedAt: toISOStringOrNull(updated.last_synced_at),
            syncEnabled: updated.sync_enabled,
            syncIntervalMinutes: updated.sync_interval_minutes,
            config: updated.config,
            orgId: updated.org_id,
            createdAt: toISOString(updated.created_at),
            updatedAt: toISOString(updated.updated_at),
          },
        },
      };
    });
  }

  @OrgAccess(integrationsContract.triggerSync, { params: ['orgId'] })
  @TsRestHandler(integrationsContract.triggerSync)
  async triggerSync() {
    return tsRestHandler(integrationsContract.triggerSync, async ({ params }) => {
      const connection = await this.integrationsService.getConnectionMeta(params.orgId, params.provider);
      if (!connection) {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Connection not found' },
        };
      }

      const syncLog = await this.integrationsService.triggerSync(
        connection.id,
        params.orgId,
        'MANUAL',
      );

      return {
        status: 200 as const,
        body: {
          success: true as const,
          data: {
            id: syncLog.id,
            connectionId: syncLog.connection_id,
            status: syncLog.status,
            trigger: syncLog.trigger,
            itemsSynced: syncLog.items_synced,
            itemsFailed: syncLog.items_failed,
            errorMessage: syncLog.error_message,
            startedAt: toISOStringOrNull(syncLog.started_at),
            completedAt: toISOStringOrNull(syncLog.completed_at),
            createdAt: toISOString(syncLog.created_at),
          },
        },
      };
    });
  }

  @OrgAccess(integrationsContract.listSyncLogs, { params: ['orgId'] })
  @TsRestHandler(integrationsContract.listSyncLogs)
  async listSyncLogs() {
    return tsRestHandler(integrationsContract.listSyncLogs, async ({ params }) => {
      const connection = await this.integrationsService.getConnectionMeta(params.orgId, params.provider);
      if (!connection) {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Connection not found' },
        };
      }

      const logs = await this.integrationsService.listSyncLogs(params.orgId, connection.id);

      return {
        status: 200 as const,
        body: {
          success: true as const,
          data: logs.map((log) => ({
            id: log.id,
            connectionId: log.connection_id,
            status: log.status,
            trigger: log.trigger,
            itemsSynced: log.items_synced,
            itemsFailed: log.items_failed,
            errorMessage: log.error_message,
            startedAt: toISOStringOrNull(log.started_at),
            completedAt: toISOStringOrNull(log.completed_at),
            createdAt: toISOString(log.created_at),
          })),
        },
      };
    });
  }

  @Public()
  @Get('/api/integrations/callback')
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      // Validate state from Redis (auto-expires via TTL)
      const stateKey = `${OAUTH_STATE_PREFIX}${state}`;
      const stateJson = await this.redis.get(stateKey);
      if (!stateJson) {
        res.redirect(`${this.frontendUrl}/dashboard/integrations?error=invalid_state`);
        return;
      }
      // Delete immediately to prevent replay
      await this.redis.del(stateKey);
      const stateData: OAuthState = JSON.parse(stateJson);

      const { org: orgIdStr, user: userIdStr, provider } = stateData;

      // Validate IDs through Zod schemas (trust boundary)
      const orgId = dbIdSchema('Org').parse(orgIdStr);
      const userId = dbIdSchema('User').parse(userIdStr);
      const validatedProvider = integrationProviderEnum.parse(provider);

      const connector = this.providerRegistry.getConnector(validatedProvider);
      const redirectUri = `${this.frontendUrl}/api/integrations/callback`;
      const tokens = await connector.exchangeCode(code, redirectUri);

      // Get external account info from the connector
      const accountInfo = await connector.getAccountInfo(tokens.accessToken);
      const externalAccountRef = accountInfo.id;
      const externalAccountName = accountInfo.name;

      await this.integrationsService.createConnection({
        orgId,
        provider: validatedProvider,
        tokens,
        externalAccountRef,
        externalAccountName,
        createdById: userId,
      });

      // Trigger initial sync
      const connection = await this.integrationsService.getConnection(orgId, validatedProvider);
      if (connection) {
        await this.integrationsService.triggerSync(connection.id, orgId, 'MANUAL');
      }

      res.redirect(`${this.frontendUrl}/dashboard/integrations?connected=${validatedProvider}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`OAuth callback failed: ${msg}`);
      res.redirect(`${this.frontendUrl}/dashboard/integrations?error=oauth_failed`);
    }
  }

  @Public()
  @Post('/api/webhooks/:provider')
  async webhookReceiver(
    @Param('provider') provider: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    res.status(200).json({ ok: true });

    try {
      const providerUpper = provider.toUpperCase();
      const parsed = integrationProviderEnum.safeParse(providerUpper);
      if (!parsed.success) return;

      const validProvider = parsed.data;
      const rows = await this.integrationsService.listConnectionsByProvider(validProvider);

      if (rows.length === 0) return;

      const connector = this.providerRegistry.getConnector(validProvider);

      // Flatten headers to string record for webhook verification
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') {
          headers[key] = value;
        }
      }

      for (const conn of rows) {
        const event = connector.parseWebhook(
          headers,
          req.body,
          conn.webhookSecret,
        );

        if (event) {
          await this.integrationsService.triggerSync(conn.id, conn.orgId, 'WEBHOOK');
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Webhook processing failed for ${provider}: ${msg}`);
    }
  }
}
