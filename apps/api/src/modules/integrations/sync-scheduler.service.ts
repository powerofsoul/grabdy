import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { sql } from 'kysely';

import { DbService } from '../../db/db.module';

import { IntegrationsService } from './integrations.service';

@Injectable()
export class SyncSchedulerService {
  private readonly logger = new Logger(SyncSchedulerService.name);

  constructor(
    private db: DbService,
    private integrationsService: IntegrationsService
  ) {}

  @Cron('* * * * *')
  async checkDueConnections(): Promise<void> {
    const dueConnections = await this.db.kysely
      .selectFrom('integration.connections')
      .select(['id', 'org_id'])
      .where('sync_enabled', '=', true)
      .where('status', '=', 'ACTIVE')
      .where((eb) =>
        eb.or([
          eb('last_synced_at', 'is', null),
          eb(
            'last_synced_at',
            '<',
            sql<Date>`now() - (sync_interval_minutes || ' minutes')::interval`
          ),
        ])
      )
      .limit(10)
      .execute();

    if (dueConnections.length === 0) return;

    this.logger.log(`Found ${dueConnections.length} connections due for sync`);

    for (const conn of dueConnections) {
      try {
        const result = await this.integrationsService.triggerSync(conn.id, conn.org_id, 'SCHEDULED');
        if (!result) {
          this.logger.log(`Skipped scheduled sync for connection ${conn.id} — already active`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to queue sync for connection ${conn.id}: ${msg}`);
      }
    }
  }
}
