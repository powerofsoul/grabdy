import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import type { BillingStatus } from '@grabdy/contracts';
import Stripe from 'stripe';

import { InjectEnv } from '../../config/env.config';
import { DbService } from '../../db/db.module';

interface BillingInvoice {
  amount: number;
  currency: string;
  status: string;
  date: string;
  url: string | null;
}

interface BillingStatusResult {
  status: BillingStatus;
  planName: string | null;
  currentPeriodEnd: string | null;
  stripeCustomer: string | null;
  invoices: BillingInvoice[];
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe | null;

  constructor(
    private db: DbService,
    @InjectEnv('stripeSecretKey') private stripeSecretKey: string
  ) {
    this.stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
  }

  async getBillingStatus(orgId: DbId<'Org'>): Promise<BillingStatusResult> {
    const org = await this.db.kysely
      .selectFrom('org.orgs')
      .select(['stripe_customer_id'])
      .where('id', '=', orgId)
      .executeTakeFirstOrThrow();

    // Auto-create Stripe customer if missing
    let stripeCustomer = org.stripe_customer_id;
    if (!stripeCustomer && this.stripe) {
      try {
        stripeCustomer = await this.ensureStripeCustomer(orgId);
      } catch {
        // Non-fatal, continue with trial status
      }
    }

    if (!stripeCustomer || !this.stripe) {
      return {
        status: 'none',
        planName: null,
        currentPeriodEnd: null,
        stripeCustomer,
        invoices: [],
      };
    }

    try {
      const [subscriptions, invoiceList] = await Promise.all([
        this.stripe.subscriptions.list({
          customer: stripeCustomer,
          limit: 5,
          status: 'all',
        }),
        this.stripe.invoices.list({
          customer: stripeCustomer,
          limit: 10,
        }),
      ]);

      const invoices: BillingInvoice[] = invoiceList.data
        .filter((inv) => inv.status === 'paid' || inv.status === 'open')
        .map((inv) => ({
          amount: inv.amount_due,
          currency: inv.currency,
          status: inv.status === 'paid' ? 'paid' : 'unpaid',
          date: new Date((inv.created ?? 0) * 1000).toISOString(),
          url: inv.hosted_invoice_url ?? null,
        }));

      // Pick the most relevant subscription: active > past_due > canceled > any
      const activeSub = subscriptions.data.find(
        (s) => s.status === 'active' || s.status === 'trialing'
      );
      const pastDueSub = subscriptions.data.find((s) => s.status === 'past_due');
      const subscription = activeSub ?? pastDueSub ?? subscriptions.data[0] ?? null;

      if (!subscription) {
        return {
          status: 'none',
          planName: null,
          currentPeriodEnd: null,
          stripeCustomer,
          invoices,
        };
      }

      const firstItem = subscription.items.data[0];
      let planName = firstItem?.price?.nickname ?? null;
      if (!planName && firstItem?.price?.product && this.stripe) {
        const productId =
          typeof firstItem.price.product === 'string'
            ? firstItem.price.product
            : firstItem.price.product.id;
        const product = await this.stripe.products.retrieve(productId);
        planName = product.name;
      }
      const periodEndTs = subscription.cancel_at ?? subscription.billing_cycle_anchor;
      const currentPeriodEnd = new Date(periodEndTs * 1000).toISOString();

      return {
        status: this.mapStripeStatus(subscription.status),
        planName,
        currentPeriodEnd,
        stripeCustomer,
        invoices,
      };
    } catch (err) {
      this.logger.warn(
        `Failed to fetch subscriptions for ${stripeCustomer}: ${err instanceof Error ? err.message : 'unknown'}`
      );
      return {
        status: 'none',
        planName: null,
        currentPeriodEnd: null,
        stripeCustomer,
        invoices: [],
      };
    }
  }

  async ensureStripeCustomer(orgId: DbId<'Org'>): Promise<string> {
    if (!this.stripe) {
      throw new BadRequestException('Billing is not available');
    }

    const org = await this.db.kysely
      .selectFrom('org.orgs')
      .select(['stripe_customer_id', 'name'])
      .where('id', '=', orgId)
      .executeTakeFirstOrThrow();

    if (org.stripe_customer_id) {
      return org.stripe_customer_id;
    }

    // Fetch the owner's email for Stripe invoicing
    const owner = await this.db.kysely
      .selectFrom('org.org_memberships')
      .innerJoin('auth.users', 'auth.users.id', 'org.org_memberships.user_id')
      .select('auth.users.email')
      .where('org.org_memberships.org_id', '=', orgId)
      .where('org.org_memberships.roles', '@>', ['OWNER'])
      .executeTakeFirst();

    const customer = await this.stripe.customers.create({
      name: org.name,
      email: owner?.email ?? undefined,
      metadata: { orgId },
    });

    // Race-safe: only set if still null
    const result = await this.db.kysely
      .updateTable('org.orgs')
      .set({
        stripe_customer_id: customer.id,
        updated_at: new Date(),
      })
      .where('id', '=', orgId)
      .where('stripe_customer_id', 'is', null)
      .returning('stripe_customer_id')
      .executeTakeFirst();

    if (!result) {
      const existing = await this.db.kysely
        .selectFrom('org.orgs')
        .select('stripe_customer_id')
        .where('id', '=', orgId)
        .executeTakeFirstOrThrow();

      if (existing.stripe_customer_id) {
        return existing.stripe_customer_id;
      }
      throw new BadRequestException('Failed to set Stripe customer ID');
    }

    return customer.id;
  }

  async createPortalSession(orgId: DbId<'Org'>, returnUrl: string): Promise<string> {
    if (!this.stripe) {
      throw new BadRequestException('Billing is not available');
    }

    const customerId = await this.ensureStripeCustomer(orgId);

    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session.url;
  }

  async syncCustomerName(orgId: DbId<'Org'>, name: string): Promise<void> {
    if (!this.stripe) return;

    const org = await this.db.kysely
      .selectFrom('org.orgs')
      .select('stripe_customer_id')
      .where('id', '=', orgId)
      .executeTakeFirstOrThrow();

    if (!org.stripe_customer_id) return;

    await this.stripe.customers.update(org.stripe_customer_id, { name });
  }

  private mapStripeStatus(status: string): BillingStatus {
    switch (status) {
      case 'active':
      case 'trialing':
        return 'active';
      case 'past_due':
        return 'past_due';
      case 'canceled':
        return 'canceled';
      case 'unpaid':
      case 'incomplete':
      case 'incomplete_expired':
        return 'unpaid';
      default:
        return 'none';
    }
  }
}
