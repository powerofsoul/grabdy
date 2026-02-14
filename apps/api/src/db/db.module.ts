import { Global, Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { Kysely, PostgresDialect } from 'kysely';
import { Pool, types } from 'pg';

import { InjectEnv } from '../config/env.config';

import type { DB } from './types';

/** Escape special ILIKE wildcards (%, _) in user-provided search terms */
export function escapeIlike(term: string): string {
  return term.replace(/[%_\\]/g, '\\$&');
}

/** Parse a PostgreSQL array literal like {FOO,BAR} into a string[] */
function parsePgTextArray(value: string): string[] {
  const inner = value.replace(/^\{|\}$/g, '');
  if (!inner) return [];
  return inner.split(',');
}

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  readonly kysely: Kysely<DB>;
  private readonly pool: Pool;
  private readonly logger = new Logger(DbService.name);

  constructor(
    @InjectEnv('databaseUrl') databaseUrl: string,
    @InjectEnv('nodeEnv') nodeEnv: string,
  ) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      options: '-c search_path=auth,org,data,api,public',
      ...(nodeEnv === 'production' && { ssl: { rejectUnauthorized: false } }),
    });
    this.kysely = new Kysely<DB>({
      dialect: new PostgresDialect({ pool: this.pool }),
    });
  }

  /** Register type parsers for custom enum array types so pg returns JS arrays */
  async onModuleInit() {
    const client = await this.pool.connect();
    try {
      const result = await client.query<{ typarray: number }>(
        `SELECT typarray FROM pg_type WHERE typname = 'OrgRole' AND typarray != 0`
      );
      for (const row of result.rows) {
        types.setTypeParser(row.typarray, parsePgTextArray);
      }
      this.logger.log(`Registered ${result.rowCount} enum array type parsers`);
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.kysely.destroy();
  }
}

@Global()
@Module({
  providers: [DbService],
  exports: [DbService],
})
export class DbModule {}
