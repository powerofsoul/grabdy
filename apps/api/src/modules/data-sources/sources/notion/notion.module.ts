import { Module } from '@nestjs/common';

import { NotionPageFetcher } from './fetcher/page.fetcher';
import { NotionWebhookService } from './webhook/notion.webhook.service';
import { NotionOAuthService } from './notion.oauth.service';
import { NotionSyncService } from './notion.sync.service';

@Module({
  providers: [NotionOAuthService, NotionWebhookService, NotionSyncService, NotionPageFetcher],
  exports: [NotionOAuthService, NotionWebhookService, NotionSyncService, NotionPageFetcher],
})
export class NotionModule {}
