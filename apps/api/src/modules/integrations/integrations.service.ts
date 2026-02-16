import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { extractOrgNumericId, packId } from '@grabdy/common';
import type { ConnectionStatus, IntegrationProvider, SyncTrigger } from '@grabdy/contracts';
import { Queue } from 'bullmq';

import { DbService } from '../../db/db.module';
import { INTEGRATION_SYNC_QUEUE } from '../queue/queue.constants';

import type { ConnectionConfig, OAuthTokens, SyncLogDetails } from './connector.interface';
import { TokenEncryptionService } from './token-encryption.service';

interface CreateConnectionParams {
  orgId: DbId<'Org'>;
  provider: IntegrationProvider;
  tokens: OAuthTokens;
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
  syncCursor?: Record<string, unknown> | null;
  lastSyncedAt?: Date;
  syncEnabled?: boolean;
  syncIntervalMinutes?: number;
  config?: ConnectionConfig;
  webhookRef?: string | null;
  webhookSecret?: string | null;
}

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private db: DbService,
    private tokenEncryption: TokenEncryptionService,
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
      syncEnabled: row.sync_enabled,
      syncIntervalMinutes: row.sync_interval_minutes,
      config: row.config,
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
      access_token: this.tokenEncryption.decrypt(row.access_token),
      refresh_token: row.refresh_token ? this.tokenEncryption.decrypt(row.refresh_token) : null,
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
      access_token: this.tokenEncryption.decrypt(row.access_token),
      refresh_token: row.refresh_token ? this.tokenEncryption.decrypt(row.refresh_token) : null,
    };
  }

  async createConnection(params: CreateConnectionParams) {
    const id = packId('Connection', extractOrgNumericId(params.orgId));

    const row = await this.db.kysely
      .insertInto('integration.connections')
      .values({
        id,
        provider: params.provider,
        access_token: this.tokenEncryption.encrypt(params.tokens.accessToken),
        refresh_token: params.tokens.refreshToken
          ? this.tokenEncryption.encrypt(params.tokens.refreshToken)
          : null,
        token_expires_at: params.tokens.expiresAt,
        scopes: params.tokens.scopes,
        external_account_id: params.externalAccountRef,
        external_account_name: params.externalAccountName,
        org_id: params.orgId,
        created_by_id: params.createdById,
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return row;
  }

  async updateConnection(connectionId: DbId<'Connection'>, updates: ConnectionUpdateFields) {
    const dbUpdates: Partial<{
      status: ConnectionStatus;
      access_token: string;
      refresh_token: string | null;
      token_expires_at: Date | null;
      scopes: string[];
      sync_cursor: Record<string, unknown> | null;
      last_synced_at: Date;
      sync_enabled: boolean;
      sync_interval_minutes: number;
      config: ConnectionConfig;
      webhook_id: string | null;
      webhook_secret: string | null;
      updated_at: Date;
    }> = { updated_at: new Date() };

    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.accessToken !== undefined) {
      dbUpdates.access_token = this.tokenEncryption.encrypt(updates.accessToken);
    }
    if (updates.refreshToken !== undefined) {
      dbUpdates.refresh_token = updates.refreshToken
        ? this.tokenEncryption.encrypt(updates.refreshToken)
        : null;
    }
    if (updates.tokenExpiresAt !== undefined) dbUpdates.token_expires_at = updates.tokenExpiresAt;
    if (updates.scopes !== undefined) dbUpdates.scopes = updates.scopes;
    if (updates.syncCursor !== undefined) dbUpdates.sync_cursor = updates.syncCursor;
    if (updates.lastSyncedAt !== undefined) dbUpdates.last_synced_at = updates.lastSyncedAt;
    if (updates.syncEnabled !== undefined) dbUpdates.sync_enabled = updates.syncEnabled;
    if (updates.syncIntervalMinutes !== undefined)
      dbUpdates.sync_interval_minutes = updates.syncIntervalMinutes;
    if (updates.config !== undefined) dbUpdates.config = updates.config;
    if (updates.webhookRef !== undefined) dbUpdates.webhook_id = updates.webhookRef;
    if (updates.webhookSecret !== undefined) dbUpdates.webhook_secret = updates.webhookSecret;

    await this.db.kysely
      .updateTable('integration.connections')
      .set(dbUpdates)
      .where('id', '=', connectionId)
      .execute();
  }

  async disconnect(orgId: DbId<'Org'>, provider: IntegrationProvider) {
    const result = await this.db.kysely
      .updateTable('integration.connections')
      .set({ status: 'DISCONNECTED', sync_enabled: false, updated_at: new Date() })
      .where('org_id', '=', orgId)
      .where('provider', '=', provider)
      .where('status', '!=', 'DISCONNECTED')
      .executeTakeFirst();

    return Number(result.numUpdatedRows) > 0;
  }

  async deleteConnection(orgId: DbId<'Org'>, provider: IntegrationProvider) {
    // Find the connection first
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
      .execute();

    // Delete the connection (sync_logs cascade from connections)
    const result = await this.db.kysely
      .deleteFrom('integration.connections')
      .where('id', '=', connection.id)
      .executeTakeFirst();

    return Number(result.numDeletedRows) > 0;
  }

  async triggerSync(connectionId: DbId<'Connection'>, orgId: DbId<'Org'>, trigger: SyncTrigger) {
    const activeSyncLog = await this.db.kysely
      .selectFrom('integration.sync_logs')
      .select('id')
      .where('connection_id', '=', connectionId)
      .where('status', 'in', ['PENDING', 'RUNNING'])
      .executeTakeFirst();

    if (activeSyncLog) {
      this.logger.log(`Sync already active for connection ${connectionId}, skipping ${trigger} trigger`);
      return null;
    }

    const syncLogId = packId('SyncLog', extractOrgNumericId(orgId));

    const syncLog = await this.db.kysely
      .insertInto('integration.sync_logs')
      .values({
        id: syncLogId,
        connection_id: connectionId,
        status: 'PENDING',
        trigger,
        org_id: orgId,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await this.syncQueue.add('sync-full', {
      connectionId,
      syncLogId,
      orgId,
      trigger,
    });

    this.logger.log(`Queued ${trigger} sync for connection ${connectionId}`);
    return syncLog;
  }

  async updateSyncLog(
    syncLogId: DbId<'SyncLog'>,
    updates: {
      status?: string;
      itemsSynced?: number;
      itemsFailed?: number;
      errorMessage?: string | null;
      details?: SyncLogDetails | null;
      startedAt?: Date;
      completedAt?: Date;
    }
  ) {
    const dbUpdates: Record<string, unknown> = {};

    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.itemsSynced !== undefined) dbUpdates.items_synced = updates.itemsSynced;
    if (updates.itemsFailed !== undefined) dbUpdates.items_failed = updates.itemsFailed;
    if (updates.errorMessage !== undefined) dbUpdates.error_message = updates.errorMessage;
    if (updates.details !== undefined) dbUpdates.details = JSON.stringify(updates.details);
    if (updates.startedAt !== undefined) dbUpdates.started_at = updates.startedAt;
    if (updates.completedAt !== undefined) dbUpdates.completed_at = updates.completedAt;

    await this.db.kysely
      .updateTable('integration.sync_logs')
      .set(dbUpdates)
      .where('id', '=', syncLogId)
      .execute();
  }

  async listConnectionsByProvider(provider: IntegrationProvider) {
    const rows = await this.db.kysely
      .selectFrom('integration.connections')
      .select(['id', 'org_id', 'webhook_secret', 'config'])
      .where('provider', '=', provider)
      .where('status', '=', 'ACTIVE')
      .execute();

    return rows.map((row) => ({
      id: row.id,
      orgId: row.org_id,
      webhookSecret: row.webhook_secret,
      config: row.config,
    }));
  }

  async listSyncLogs(orgId: DbId<'Org'>, connectionId: DbId<'Connection'>) {
    return this.db.kysely
      .selectFrom('integration.sync_logs')
      .selectAll()
      .where('org_id', '=', orgId)
      .where('connection_id', '=', connectionId)
      .orderBy('created_at', 'desc')
      .limit(50)
      .execute();
  }
}
