import 'dotenv/config';

import { promises as fs } from 'fs';
import { FileMigrationProvider, Kysely, Migrator, PostgresDialect, sql } from 'kysely';
import * as path from 'path';
import { Pool } from 'pg';

import { loadSsmParameters } from '../config/ssm';

async function createDb() {
  // Populate process.env from SSM + Secrets Manager (no-op in dev)
  await loadSsmParameters();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const pool = new Pool({
    connectionString: databaseUrl,
    ...(isProduction && { ssl: { rejectUnauthorized: false } }),
  });
  return { pool, db: new Kysely<unknown>({ dialect: new PostgresDialect({ pool }) }) };
}

async function migrate() {
  const { db } = await createDb();

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  for (const result of results ?? []) {
    if (result.status === 'Success') {
      console.log(`✓ ${result.migrationName}`);
    } else if (result.status === 'Error') {
      console.error(`✗ ${result.migrationName}`);
    }
  }

  if (error) {
    await db.destroy();
    throw new Error(`Migration failed: ${error}`);
  }

  console.log('Migrations complete.');
  await db.destroy();
}

async function fresh() {
  const { db } = await createDb();

  console.log('Dropping all objects...');
  await sql`
    DROP SCHEMA IF EXISTS auth CASCADE;
    DROP SCHEMA IF EXISTS org CASCADE;
    DROP SCHEMA IF EXISTS data CASCADE;
    DROP SCHEMA IF EXISTS integration CASCADE;
    DROP SCHEMA IF EXISTS api CASCADE;
    DROP SCHEMA IF EXISTS analytics CASCADE;
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public
  `.execute(db);
  await db.destroy();

  console.log('Running migrations from scratch...');
  await migrate();
}

const command = process.argv[2];
if (command === 'fresh') {
  fresh();
} else {
  migrate();
}
