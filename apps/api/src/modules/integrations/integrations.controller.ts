import { Controller, Get, Logger, Param, Post, Query, Req, Res } from '@nestjs/common';

import { dbIdSchema } from '@grabdy/common';
import { integrationProviderEnum, integrationsContract } from '@grabdy/contracts';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { CurrentUser, type JwtPayload } from '../../common/decorators/current-user.decorator';
import { OrgAccess } from '../../common/decorators/org-roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { InjectEnv } from '../../config/env.config';
import { RedisService } from '../../redis/redis.module';
import { redisKeys } from '../../redis/redis-keys';

import { parseProviderData, parsePublicProviderData } from './connector.interface';
import { IntegrationsService } from './integrations.service';
import { ProviderRegistry } from './provider-registry';

const oauthStateSchema = z.object({
  org: z.string(),
  user: z.string(),
  provider: z.string(),
});

type OAuthState = z.infer<typeof oauthStateSchema>;

const OAUTH_STATE_TTL_SECONDS = 600; // 10 minutes

const notionVerificationSchema = z.object({ verification_token: z.string() });

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
    private redis: RedisService,
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
            const entry = this.providerRegistry.has(c.provider)
              ? this.providerRegistry.get(c.provider)
              : null;
            const syncScheduleLabel = entry?.syncSchedule
              ? formatSyncScheduleLabel(entry.syncSchedule.every)
              : null;
            return {
              ...c,
              providerData: parsePublicProviderData(c.providerData),
              lastSyncedAt: toISOStringOrNull(c.lastSyncedAt),
              syncScheduleLabel,
              createdAt: toISOString(c.createdAt),
              updatedAt: toISOString(c.updatedAt),
              dataSourceCount: c.dataSourceCount,
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

      if (!this.providerRegistry.has(provider)) {
        return {
          status: 400 as const,
          body: { success: false as const, error: `Provider ${provider} is not yet supported` },
        };
      }

      const entry = this.providerRegistry.get(provider);

      // Generate OAuth state token and store in Redis with TTL
      const state = randomBytes(32).toString('hex');
      const stateData: OAuthState = {
        org: params.orgId,
        user: user.sub,
        provider,
      };
      await this.redis.set(
        redisKeys.oauthState(state),
        JSON.stringify(stateData),
        'EX',
        OAUTH_STATE_TTL_SECONDS
      );

      const redirectUri = `${this.apiUrl}/integrations/callback`;
      const redirectUrl = entry.oauth.getAuthUrl(params.orgId, state, redirectUri);

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
      const entry = this.providerRegistry.has(params.provider)
        ? this.providerRegistry.get(params.provider)
        : null;

      if (!entry?.oauth.listResources) {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Provider does not support resource listing' },
        };
      }

      const connection = await this.integrationsService.getConnection(
        params.orgId,
        params.provider
      );
      if (!connection) {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Connection not found' },
        };
      }

      const providerData = parseProviderData(connection.provider_data);
      const resources = await entry.oauth.listResources(connection.access_token, providerData);

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
        await this.integrationsService.startSyncWorkflow(
          connection.id,
          params.orgId,
          params.provider,
          'MANUAL'
        );
      }

      // Re-fetch via listConnections to include dataSourceCount
      const allConnections = await this.integrationsService.listConnections(params.orgId);
      const updated = allConnections.find((c) => c.provider === params.provider);
      if (!updated) {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Connection not found' },
        };
      }

      const entry = this.providerRegistry.has(updated.provider)
        ? this.providerRegistry.get(updated.provider)
        : null;
      const syncScheduleLabel = entry?.syncSchedule
        ? formatSyncScheduleLabel(entry.syncSchedule.every)
        : null;

      return {
        status: 200 as const,
        body: {
          success: true as const,
          data: {
            id: updated.id,
            provider: updated.provider,
            status: updated.status,
            externalAccountId: updated.externalAccountId,
            externalAccountName: updated.externalAccountName,
            lastSyncedAt: toISOStringOrNull(updated.lastSyncedAt),
            syncScheduleLabel,
            dataSourceCount: updated.dataSourceCount,
            providerData: parsePublicProviderData(updated.providerData),
            orgId: updated.orgId,
            createdAt: toISOString(updated.createdAt),
            updatedAt: toISOString(updated.updatedAt),
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
      const stateKey = redisKeys.oauthState(state);
      const stateJson = await this.redis.get(stateKey);
      if (!stateJson) {
        res.redirect(`${this.frontendUrl}/dashboard/integrations?error=invalid_state`);
        return;
      }
      // Delete immediately to prevent replay
      await this.redis.del(stateKey);
      const stateData = oauthStateSchema.parse(JSON.parse(stateJson));

      const { org: orgIdStr, user: userIdStr, provider } = stateData;

      // Validate IDs through Zod schemas (trust boundary)
      const orgId = dbIdSchema('Org').parse(orgIdStr);
      const userId = dbIdSchema('User').parse(userIdStr);
      const validatedProvider = integrationProviderEnum.parse(provider);

      const entry = this.providerRegistry.get(validatedProvider);
      const redirectUri = `${this.apiUrl}/integrations/callback`;

      // GitHub App sends installation_id instead of code
      const exchangeCode = installationId ?? code;
      if (!exchangeCode) {
        res.redirect(`${this.frontendUrl}/dashboard/integrations?error=missing_code`);
        return;
      }
      const tokens = await entry.oauth.exchangeCode(exchangeCode, redirectUri);

      // Get external account info
      const accountInfo = await entry.oauth.getAccountInfo(tokens.accessToken);
      const externalAccountRef = accountInfo.id;
      const externalAccountName = accountInfo.name;

      // Remove any existing connection for this org+provider (e.g. DISCONNECTED) before creating a new one
      await this.integrationsService.deleteConnection(orgId, validatedProvider);

      // Build provider data before creating the connection so the row is never in an invalid state
      const providerData = entry.oauth.buildInitialProviderData(
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

      // Create repeatable job for periodic syncs
      await this.integrationsService.createSyncSchedule(newConnection.id, orgId, validatedProvider);

      // Trigger initial sync
      await this.integrationsService.startSyncWorkflow(
        newConnection.id,
        orgId,
        validatedProvider,
        'INITIAL'
      );

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

      // Notion webhook verification must be answered before any DB lookup
      // (connections may not exist yet during initial webhook setup)
      if (providerUpper === 'NOTION' && notionVerificationSchema.safeParse(body).success) {
        this.logger.log('Received Notion webhook verification token');
        res.status(200).json({ ok: true });
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
      const rawBodyStr =
        typeof rawBody === 'string'
          ? rawBody
          : Buffer.isBuffer(rawBody)
            ? rawBody.toString('utf8')
            : undefined;
      const entry = this.providerRegistry.get(validProvider);

      // Verify webhook signature before processing
      if (!entry.webhook.verify(headers, req.body, rawBodyStr)) {
        this.logger.warn(`Webhook signature verification failed for ${validProvider}`);
        res.status(200).json({ ok: true });
        return;
      }

      const result = entry.webhook.handleEvent(headers, req.body, connections, rawBodyStr);

      // Handle disconnection events (e.g. GitHub App uninstalled)
      if (result.disconnectConnections) {
        for (const conn of result.disconnectConnections) {
          await this.integrationsService.disconnect(conn.orgId, validProvider);
        }
      }

      // Queue webhook sync jobs for matched connections
      if (result.syncConnections) {
        for (const syncConn of result.syncConnections) {
          await this.integrationsService.startWebhookWorkflow(
            syncConn.id,
            syncConn.orgId,
            validProvider,
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
