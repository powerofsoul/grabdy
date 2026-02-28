/**
 * One-off script to create Stripe customers for all orgs that don't have one.
 *
 * Usage:
 *   cd apps/api && npx ts-node -r tsconfig-paths/register src/scripts/backfill-stripe-customers.ts
 *
 * Requires STRIPE_SECRET_KEY and DATABASE_URL env vars.
 */
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import Stripe from 'stripe';

import type { DB } from '../db/db';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return value;
}

const DATABASE_URL = requireEnv('DATABASE_URL');
const STRIPE_SECRET_KEY = requireEnv('STRIPE_SECRET_KEY');

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = new Kysely<DB>({
    dialect: new PostgresDialect({ pool }),
  });
  const stripe = new Stripe(STRIPE_SECRET_KEY);

  const orgs = await db
    .selectFrom('org.orgs')
    .select(['id', 'name'])
    .where('stripe_customer_id', 'is', null)
    .execute();

  console.log(`Found ${orgs.length} orgs without Stripe customer`);

  let created = 0;
  let failed = 0;

  for (const org of orgs) {
    try {
      const customer = await stripe.customers.create({
        name: org.name,
        metadata: { orgId: org.id },
      });

      await db
        .updateTable('org.orgs')
        .set({
          stripe_customer_id: customer.id,
          updated_at: new Date(),
        })
        .where('id', '=', org.id)
        .where('stripe_customer_id', 'is', null)
        .execute();

      created++;
      console.log(`[${created}/${orgs.length}] ${org.name} -> ${customer.id}`);
    } catch (err) {
      failed++;
      console.error(
        `Failed for org ${org.id} (${org.name}): ${err instanceof Error ? err.message : 'unknown'}`
      );
    }
  }

  console.log(`Done. Created: ${created}, Failed: ${failed}`);

  await db.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
