import { Module } from '@nestjs/common';

import { GitHubDiscussionFetcher } from './fetcher/discussion.fetcher';
import { GitHubIssueFetcher } from './fetcher/issue.fetcher';
import { GitHubPrFetcher } from './fetcher/pr.fetcher';
import { GitHubDiscussionWebhookHandler } from './webhook/discussion.webhook';
import { GitHubWebhookService } from './webhook/github.webhook.service';
import { GitHubIssueWebhookHandler } from './webhook/issue.webhook';
import { GitHubPrWebhookHandler } from './webhook/pr.webhook';
import { GitHubOAuthService } from './github.oauth.service';
import { GitHubSyncService } from './github.sync.service';

@Module({
  providers: [
    GitHubOAuthService,
    GitHubWebhookService,
    GitHubSyncService,
    GitHubIssueFetcher,
    GitHubPrFetcher,
    GitHubDiscussionFetcher,
    GitHubIssueWebhookHandler,
    GitHubPrWebhookHandler,
    GitHubDiscussionWebhookHandler,
  ],
  exports: [
    GitHubOAuthService,
    GitHubWebhookService,
    GitHubSyncService,
    GitHubIssueFetcher,
    GitHubPrFetcher,
    GitHubDiscussionFetcher,
  ],
})
export class GitHubModule {}
