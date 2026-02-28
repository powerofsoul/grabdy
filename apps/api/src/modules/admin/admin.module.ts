import { Module } from '@nestjs/common';

import { AnalyticsModule } from '../analytics/analytics.module';

import { AdminController } from './admin.controller';

@Module({
  imports: [AnalyticsModule],
  controllers: [AdminController],
})
export class AdminModule {}
