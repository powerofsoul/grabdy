import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { extractOrgNumericId, packId } from '@grabdy/common';
import type { ConnectionStatus, IntegrationProvider, SyncTrigger } from '@grabdy/contracts';
import { sql } from 'kysely';

import { EncryptionService } from '../../common/encryption/encryption.service';
import { DbService } from '../../db/db.module';
import { InngestService } from '../../inngest/inngest.service';

import { ProviderRegistry } from './providers/provider-registry';
import {
  type OAuthTokens,
  parseProviderData,
  type ProviderData,
  type WebhookEvent,
} from './connector.interface';

interface CreateConnectionParams {
  orgId: DbId<'Org'>;
  provider: IntegrationProvider;
  tokens: OAuthTokens;
  providerData: ProviderData;
  externalAccountRef: string | null;
  externalAccountName: string | null;
  createdById: DbId<'User'>;
}

interface ConnectionUpdateFields {
  status?: ConnectionStatus;
  accessToken?: string;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  scopes?: string[];
  lastSyncedAt?: Date;
  providerData?: ProviderData;
}

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private db: DbService,
    private encryption: EncryptionService,
    private providerRegistry: ProviderRegistry,
    private inngestService: InngestService
  ) {}

  async listConnections(orgId: DbId<'Org'>) {
    const rows = await this.db.kysely
      .selectFrom('integration.connections')
      .selectAll()
      .where('org_id', '=', orgId)
      .orderBy('created_at', 'asc')
      .execute();

    return rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      status: row.status,
      externalAccountId: row.external_account_id,
      externalAccountName: row.external_account_name,
      lastSyncedAt: row.last_synced_at,
      providerData: row.provider_data,
      orgId: row.org_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /** Returns connection with decrypted tokens — use only when tokens are needed (sync). */
  async getConnection(orgId: DbId<'Org'>, provider: IntegrationProvider) {
    const row = await this.db.kysely
      .selectFrom('integration.connections')
      .selectAll()
      .where('org_id', '=', orgId)
      .where('provider', '=', provider)
      .executeTakeFirst();

    if (!row) return null;

    return {
      ...row,
      access_token: await this.encryption.decrypt(row.access_token),
      refresh_token: row.refresh_token ? await this.encryption.decrypt(row.refresh_token) : null,
    };
  }

  /**
   * Returns a valid access token, refreshing it first if expired or near expiry.
   * Use this instead of getConnection() when you only need the token for API calls.
   */
  async getValidAccessToken(
    orgId: DbId<'Org'>,
    provider: IntegrationProvider
  ): Promise<string | null> {
    const connection = await this.getConnection(orgId, provider);
    if (!connection) return null;

    const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

    if (connection.token_expires_at) {
      const expiresAt = new Date(connection.token_expires_at).getTime();
      if (expiresAt - Date.now() < TOKEN_REFRESH_BUFFER_MS) {
        if (!connection.refresh_token) {
          this.logger.warn(
            `${provider} token expired for org ${orgId} but no refresh token available`
          );
          return null;
        }
        this.logger.log(`Refreshing expired ${provider} token for org ${orgId}`);
        try {
          const connector = this.providerRegistry.getConnector(provider);
          const newTokens = await connector.refreshTokens(connection.refresh_token);
          await this.updateConnection(connection.id, {
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
            tokenExpiresAt: newTokens.expiresAt,
          });
          return newTokens.accessToken;
        } catch (err) {
          this.logger.error(`Failed to refresh ${provider} token for org ${orgId}: ${err}`);
          return null;
        }
      }
    }

    return connection.access_token;
  }

  /** Returns connection metadata without decrypting tokens — safe for controller use. */
  async getConnectionMeta(orgId: DbId<'Org'>, provider: IntegrationProvider) {
    return this.db.kysely
      .selectFrom('integration.connections')
      .selectAll()
      .where('org_id', '=', orgId)
      .where('provider', '=', provider)
      .executeTakeFirst();
  }

  async getConnectionById(connectionId: DbId<'Connection'>) {
    // org-safe: system-level lookup by ID for sync processing
    const row = await this.db.kysely
      .selectFrom('integration.connections')
      .selectAll()
      .where('id', '=', connectionId)
      .executeTakeFirst();

    if (!row) return null;

    return {
      ...row,
      access_token: await this.encryption.decrypt(row.access_token),
      refresh_token: row.refresh_token ? await this.encryption.decrypt(row.refresh_token) : null,
    };
  }

  async createConnection(params: CreateConnectionParams) {
    const id = packId('Connection', extractOrgNumericId(params.orgId));

    const row = await this.db.kysely
      .insertInto('integration.connections')
      .values({
        id,
        provider: params.provider,
        access_token: await this.encryption.encrypt(params.tokens.accessToken),
        refresh_token: params.tokens.refreshToken
          ? await this.encryption.encrypt(params.tokens.refreshToken)
          : null,
        token_expires_at: params.tokens.expiresAt,
        scopes: params.tokens.scopes,
        external_account_id: params.externalAccountRef,
        external_account_name: params.externalAccountName,
        provider_data: sql`${JSON.stringify(params.providerData)}::jsonb`,
        org_id: params.orgId,
        created_by_id: params.createdById,
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return row;
  }

  async updateConnection(connectionId: DbId<'Connection'>, updates: ConnectionUpdateFields) {
    // org-safe: system-level update after authenticated lookup
    let query = this.db.kysely
      .updateTable('integration.connections')
      .set('updated_at', new Date())
      .where('id', '=', connectionId);

    if (updates.status !== undefined) {
      query = query.set('status', updates.status);
    }
    if (updates.accessToken !== undefined) {
      query = query.set('access_token', await this.encryption.encrypt(updates.accessToken));
    }
    if (updates.refreshToken !== undefined) {
      query = query.set(
        'refresh_token',
        updates.refreshToken ? await this.encryption.encrypt(updates.refreshToken) : null
      );
    }
    if (updates.tokenExpiresAt !== undefined) {
      query = query.set('token_expires_at', updates.tokenExpiresAt);
    }
    if (updates.scopes !== undefined) {
      query = query.set('scopes', updates.scopes);
    }
    if (updates.lastSyncedAt !== undefined) {
      query = query.set('last_synced_at', updates.lastSyncedAt);
    }
    if (updates.providerData !== undefined) {
      query = query.set('provider_data', sql`${JSON.stringify(updates.providerData)}::jsonb`);
    }

    await query.execute();
  }

  async disconnect(orgId: DbId<'Org'>, provider: IntegrationProvider) {
    const connection = await this.db.kysely
      .selectFrom('integration.connections')
      .select(['id', 'access_token', 'provider_data'])
      .where('org_id', '=', orgId)
      .where('provider', '=', provider)
      .where('status', '!=', 'DISCONNECTED')
      .executeTakeFirst();

    if (!connection) return false;

    // Best-effort revoke at the provider level
    try {
      const accessToken = await this.encryption.decrypt(connection.access_token);
      const providerData = parseProviderData(connection.provider_data);
      const connector = this.providerRegistry.getConnector(provider);
      await connector.revoke(accessToken, providerData);
    } catch (err) {
      this.logger.warn(`Failed to revoke ${provider} tokens for org ${orgId}: ${err}`);
    }

    await this.db.kysely
      .updateTable('integration.connections')
      .set({ status: 'DISCONNECTED', updated_at: new Date() })
      .where('id', '=', connection.id)
      .where('org_id', '=', orgId)
      .execute();

    return true;
  }

  async deleteConnection(orgId: DbId<'Org'>, provider: IntegrationProvider) {
    const connection = await this.db.kysely
      .selectFrom('integration.connections')
      .select(['id'])
      .where('org_id', '=', orgId)
      .where('provider', '=', provider)
      .executeTakeFirst();

    if (!connection) return false;

    // Delete associated data sources (chunks cascade from data_sources)
    await this.db.kysely
      .deleteFrom('data.data_sources')
      .where('connection_id', '=', connection.id)
      .where('org_id', '=', orgId)
      .execute();

    const result = await this.db.kysely
      .deleteFrom('integration.connections')
      .where('id', '=', connection.id)
      .where('org_id', '=', orgId)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }

  async triggerSync(connectionId: DbId<'Connection'>, orgId: DbId<'Org'>, trigger: SyncTrigger) {
    await this.inngestService.send('app/integration.discover', {
      connectionId,
      orgId,
      trigger,
    });

    this.logger.log(`Queued ${trigger} discovery for connection ${connectionId}`);
  }

  async triggerWebhookSync(
    connectionId: DbId<'Connection'>,
    orgId: DbId<'Org'>,
    event: WebhookEvent
  ) {
    await this.inngestService.send('app/integration.process-item', {
      connectionId,
      orgId,
      event,
    });

    this.logger.log(
      `Queued process-item for connection ${connectionId}: ${event.action} ${event.externalId}`
    );
  }

  async listConnectionsByProvider(provider: IntegrationProvider) {
    // org-safe: cross-org listing for webhook routing
    const rows = await this.db.kysely
      .selectFrom('integration.connections')
      .select(['id', 'org_id', 'provider_data'])
      .where('provider', '=', provider)
      .where('status', '=', 'ACTIVE')
      .execute();

    return rows.map((row) => ({
      id: row.id,
      orgId: row.org_id,
      providerData: parseProviderData(row.provider_data),
    }));
  }
}
