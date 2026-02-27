import { Module } from '@nestjs/common';

import { LinearIssueFetcher } from './fetcher/issue.fetcher';
import { LinearWebhookService } from './webhook/linear.webhook.service';
import { LinearOAuthService } from './linear.oauth.service';
import { LinearSyncService } from './linear.sync.service';

@Module({
  providers: [LinearOAuthService, LinearWebhookService, LinearSyncService, LinearIssueFetcher],
  exports: [LinearOAuthService, LinearWebhookService, LinearSyncService, LinearIssueFetcher],
})
export class LinearModule {}
