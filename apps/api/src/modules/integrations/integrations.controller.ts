import { Controller, Get, Inject, Logger, Param, Post, Query, Req, Res } from '@nestjs/common';

import { dbIdSchema } from '@grabdy/common';
import { integrationProviderEnum, integrationsContract } from '@grabdy/contracts';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import type Redis from 'ioredis';

import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { OrgAccess } from '../../common/decorators/org-roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { InjectEnv } from '../../config/env.config';

import { ProviderRegistry } from './providers/provider-registry';
import { parseProviderData, parsePublicProviderData } from './connector.interface';
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

function formatSyncScheduleLabel(everyMs: number): string {
  const hours = Math.round(everyMs / 3_600_000);
  if (hours === 1) return 'Updates every hour';
  if (hours > 1) return `Updates every ${hours} hours`;
  const minutes = Math.round(everyMs / 60_000);
  return `Updates every ${minutes} minutes`;
}

@Controller()
export class IntegrationsController {
  private readonly logger = new Logger(IntegrationsController.name);

  constructor(
    private integrationsService: IntegrationsService,
    private providerRegistry: ProviderRegistry,
    @Inject(INTEGRATIONS_REDIS) private readonly redis: Redis,
    @InjectEnv('frontendUrl') private readonly frontendUrl: string,
    @InjectEnv('apiUrl') private readonly apiUrl: string
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
          data: connections.map((c) => {
            const connector = this.providerRegistry.hasConnector(c.provider)
              ? this.providerRegistry.getConnector(c.provider)
              : null;
            const syncScheduleLabel = connector?.syncSchedule
              ? formatSyncScheduleLabel(connector.syncSchedule.every)
              : null;
            return {
              ...c,
              providerData: parsePublicProviderData(c.providerData),
              lastSyncedAt: toISOStringOrNull(c.lastSyncedAt),
              syncScheduleLabel,
              createdAt: toISOString(c.createdAt),
              updatedAt: toISOString(c.updatedAt),
            };
          }),
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
        OAUTH_STATE_TTL_SECONDS
      );

      const redirectUri = `${this.apiUrl}/integrations/callback`;
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

  @OrgAccess(integrationsContract.deleteConnection, { params: ['orgId'] })
  @TsRestHandler(integrationsContract.deleteConnection)
  async deleteConnection() {
    return tsRestHandler(integrationsContract.deleteConnection, async ({ params }) => {
      const success = await this.integrationsService.deleteConnection(
        params.orgId,
        params.provider
      );

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

  @OrgAccess(integrationsContract.listResources, { params: ['orgId'] })
  @TsRestHandler(integrationsContract.listResources)
  async listResources() {
    return tsRestHandler(integrationsContract.listResources, async ({ params }) => {
      const connector = this.providerRegistry.hasConnector(params.provider)
        ? this.providerRegistry.getConnector(params.provider)
        : null;

      if (!connector?.listResources) {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Provider does not support resource listing' },
        };
      }

      const connection = await this.integrationsService.getConnection(params.orgId, params.provider);
      if (!connection) {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Connection not found' },
        };
      }

      const providerData = parseProviderData(connection.provider_data);
      const resources = await connector.listResources(connection.access_token, providerData);

      return {
        status: 200 as const,
        body: { success: true as const, data: resources },
      };
    });
  }

  @OrgAccess(integrationsContract.updateConfig, { params: ['orgId'] })
  @TsRestHandler(integrationsContract.updateConfig)
  async updateConfig() {
    return tsRestHandler(integrationsContract.updateConfig, async ({ params, body }) => {
      const connection = await this.integrationsService.getConnectionMeta(
        params.orgId,
        params.provider
      );
      if (!connection) {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Connection not found' },
        };
      }

      // Read-merge-write: parse existing provider data, merge partial config, write back
      if (body.config) {
        const current = parseProviderData(connection.provider_data);
        const merged = { ...current, ...body.config };
        await this.integrationsService.updateConnection(connection.id, {
          providerData: parseProviderData(merged),
        });

        // Trigger a sync so the connector can join newly selected channels
        await this.integrationsService.triggerSync(connection.id, params.orgId, 'MANUAL');
      }

      const updated = await this.integrationsService.getConnectionMeta(
        params.orgId,
        params.provider
      );
      if (!updated) {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Connection not found' },
        };
      }

      const connector = this.providerRegistry.hasConnector(updated.provider)
        ? this.providerRegistry.getConnector(updated.provider)
        : null;
      const syncScheduleLabel = connector?.syncSchedule
        ? formatSyncScheduleLabel(connector.syncSchedule.every)
        : null;

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
            syncScheduleLabel,
            providerData: parsePublicProviderData(updated.provider_data),
            orgId: updated.org_id,
            createdAt: toISOString(updated.created_at),
            updatedAt: toISOString(updated.updated_at),
          },
        },
      };
    });
  }

  @Public()
  @Get('/integrations/callback')
  async oauthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string,
    @Query('installation_id') installationId: string | undefined,
    @Res() res: Response
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
      const redirectUri = `${this.apiUrl}/integrations/callback`;

      // GitHub App sends installation_id instead of code
      const exchangeCode = installationId ?? code;
      if (!exchangeCode) {
        res.redirect(`${this.frontendUrl}/dashboard/integrations?error=missing_code`);
        return;
      }
      const tokens = await connector.exchangeCode(exchangeCode, redirectUri);

      // Get external account info from the connector
      const accountInfo = await connector.getAccountInfo(tokens.accessToken);
      const externalAccountRef = accountInfo.id;
      const externalAccountName = accountInfo.name;

      // Remove any existing connection for this org+provider (e.g. DISCONNECTED) before creating a new one
      await this.integrationsService.deleteConnection(orgId, validatedProvider);

      // Build provider data before creating the connection so the row is never in an invalid state
      const providerData = connector.buildInitialProviderData(
        tokens.metadata,
        accountInfo.metadata
      );

      const newConnection = await this.integrationsService.createConnection({
        orgId,
        provider: validatedProvider,
        tokens,
        providerData,
        externalAccountRef,
        externalAccountName,
        createdById: userId,
      });

      // Register scheduled sync if the provider needs it
      if (connector.syncSchedule) {
        await this.integrationsService.registerScheduledSync(
          newConnection.id,
          connector.syncSchedule.every
        );
      }

      // Trigger initial sync
      await this.integrationsService.triggerSync(newConnection.id, orgId, 'INITIAL');

      res.redirect(`${this.frontendUrl}/dashboard/integrations?connected=${validatedProvider}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`OAuth callback failed: ${msg}`);
      res.redirect(`${this.frontendUrl}/dashboard/integrations?error=oauth_failed`);
    }
  }

  @Public()
  @Post('/integrations/webhook/:provider')
  async webhookReceiver(
    @Param('provider') provider: string,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    try {
      const providerUpper = provider.toUpperCase();
      const parsed = integrationProviderEnum.safeParse(providerUpper);
      if (!parsed.success) {
        res.status(200).json({ ok: true });
        return;
      }

      // Slack url_verification must be answered before any DB lookup
      const body = req.body;
      if (
        typeof body === 'object' &&
        body !== null &&
        'type' in body &&
        body.type === 'url_verification' &&
        'challenge' in body
      ) {
        res.status(200).json({ challenge: body.challenge });
        return;
      }

      const validProvider = parsed.data;
      const connections = await this.integrationsService.listConnectionsByProvider(validProvider);
      if (connections.length === 0) {
        res.status(200).json({ ok: true });
        return;
      }

      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') {
          headers[key] = value;
        }
      }

      const rawBody = 'rawBody' in req ? req.rawBody : undefined;
      const connector = this.providerRegistry.getConnector(validProvider);
      const result = connector.handleWebhookRequest(
        headers,
        req.body,
        connections,
        typeof rawBody === 'string' ? rawBody : undefined
      );

      // Handle disconnection events (e.g. GitHub App uninstalled)
      if (result.disconnectConnections) {
        for (const conn of result.disconnectConnections) {
          await this.integrationsService.disconnect(conn.orgId, validProvider);
        }
      }

      // Queue webhook sync jobs for matched connections
      if (result.syncConnections) {
        for (const syncConn of result.syncConnections) {
          await this.integrationsService.triggerWebhookSync(
            syncConn.id,
            syncConn.orgId,
            syncConn.event
          );
        }
      }

      res.status(200).json(result.response);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Webhook processing failed for ${provider}: ${msg}`);
      if (!res.headersSent) {
        res.status(200).json({ ok: true });
      }
    }
  }
}
