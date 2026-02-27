import { Injectable, Logger } from '@nestjs/common';

import type { SyncedItem, WebhookEvent } from '../../../../integrations/connector.interface';
import { GitHubDiscussionFetcher } from '../fetcher/discussion.fetcher';
import { discussionWebhookSchema } from '../types';
import { parseGitHubExternalId } from '../utils';

@Injectable()
export class GitHubDiscussionWebhookHandler {
  private readonly logger = new Logger(GitHubDiscussionWebhookHandler.name);

  constructor(private readonly discussionFetcher: GitHubDiscussionFetcher) {}

  extract(action: string | undefined, body: unknown, repo: string): WebhookEvent | null {
    const parsed = discussionWebhookSchema.safeParse(body);
    if (!parsed.success) return null;

    let webhookAction: WebhookEvent['action'];
    if (action === 'created') webhookAction = 'created';
    else if (action === 'deleted') webhookAction = 'deleted';
    else webhookAction = 'updated';

    return {
      action: webhookAction,
      externalId: `${repo}#${parsed.data.discussion.number}`,
      eventType: 'discussion',
    };
  }

  async fetchItem(accessToken: string, externalId: string): Promise<SyncedItem | null> {
    const parsed = parseGitHubExternalId(externalId);
    if (!parsed) {
      this.logger.warn(`Invalid GitHub external ID format: ${externalId}`);
      return null;
    }

    return this.discussionFetcher.fetchItem(
      accessToken,
      parsed.owner,
      parsed.repoName,
      parsed.repoFullName,
      parsed.number
    );
  }
}
