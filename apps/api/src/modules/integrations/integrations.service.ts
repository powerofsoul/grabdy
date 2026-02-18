import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { extractOrgNumericId, packId } from '@grabdy/common';
import type { ConnectionStatus, IntegrationProvider, SyncTrigger } from '@grabdy/contracts';
import { Queue } from 'bullmq';
import { sql } from 'kysely';

import { EncryptionService } from '../../common/encryption/encryption.service';
import { DbService } from '../../db/db.module';
import { INTEGRATION_SYNC_QUEUE } from '../queue/queue.constants';

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
    @InjectQueue(INTEGRATION_SYNC_QUEUE) private syncQueue: Queue
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
      .select(['id'])
      .where('org_id', '=', orgId)
      .where('provider', '=', provider)
      .where('status', '!=', 'DISCONNECTED')
      .executeTakeFirst();

    if (!connection) return false;

    await this.removeScheduledSync(connection.id, provider);

    await this.db.kysely
      .updateTable('integration.connections')
      .set({ status: 'DISCONNECTED', updated_at: new Date() })
      .where('id', '=', connection.id)
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

    await this.removeScheduledSync(connection.id, provider);

    // Delete associated data sources (chunks cascade from data_sources)
    await this.db.kysely
      .deleteFrom('data.data_sources')
      .where('connection_id', '=', connection.id)
      .execute();

    const result = await this.db.kysely
      .deleteFrom('integration.connections')
      .where('id', '=', connection.id)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }

  async triggerSync(connectionId: DbId<'Connection'>, orgId: DbId<'Org'>, trigger: SyncTrigger) {
    await this.syncQueue.add('sync-full', {
      connectionId,
      orgId,
      trigger,
    });

    this.logger.log(`Queued ${trigger} sync for connection ${connectionId}`);
  }

  async triggerWebhookSync(
    connectionId: DbId<'Connection'>,
    orgId: DbId<'Org'>,
    event: WebhookEvent
  ) {
    await this.syncQueue.add('sync-webhook', {
      connectionId,
      orgId,
      event,
    });

    this.logger.log(
      `Queued webhook sync for connection ${connectionId}, event: ${event.action} ${event.externalId}`
    );
  }

  async registerScheduledSync(connectionId: DbId<'Connection'>, everyMs: number) {
    await this.syncQueue.add(
      'sync-scheduled',
      { connectionId },
      { repeat: { every: everyMs }, jobId: `scheduled-${connectionId}` }
    );
    this.logger.log(`Registered scheduled sync every ${everyMs}ms for connection ${connectionId}`);
  }

  async removeScheduledSync(connectionId: DbId<'Connection'>, provider: IntegrationProvider) {
    const connector = this.providerRegistry.getConnector(provider);
    if (!connector.syncSchedule) return;

    try {
      await this.syncQueue.removeRepeatable('sync-scheduled', {
        every: connector.syncSchedule.every,
        jobId: `scheduled-${connectionId}`,
      });
      this.logger.log(`Removed scheduled sync for connection ${connectionId}`);
    } catch {
      // Repeatable job may not exist — safe to ignore
    }
  }

  async listConnectionsByProvider(provider: IntegrationProvider) {
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
