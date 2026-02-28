import { Module } from '@nestjs/common';

import { AnalyticsModule } from '../analytics/analytics.module';
import { BillingModule } from '../billing/billing.module';

import { AdminController } from './admin.controller';

@Module({
  imports: [AnalyticsModule, BillingModule],
  controllers: [AdminController],
})
export class AdminModule {}
