import { Injectable, Logger } from '@nestjs/common';

import { Octokit } from '@octokit/rest';

import type { SyncedItem, WebhookEvent } from '../../../../integrations/connector.interface';
import { GitHubIssueFetcher } from '../fetcher/issue.fetcher';
import { issueWebhookSchema } from '../types';
import { parseGitHubExternalId } from '../utils';

@Injectable()
export class GitHubIssueWebhookHandler {
  private readonly logger = new Logger(GitHubIssueWebhookHandler.name);

  constructor(private readonly issueFetcher: GitHubIssueFetcher) {}

  extract(action: string | undefined, body: unknown, repo: string): WebhookEvent | null {
    const parsed = issueWebhookSchema.safeParse(body);
    if (!parsed.success) return null;

    let webhookAction: WebhookEvent['action'];
    if (action === 'opened' || action === 'created') webhookAction = 'created';
    else if (action === 'deleted') webhookAction = 'deleted';
    else webhookAction = 'updated';

    return {
      action: webhookAction,
      externalId: `${repo}#${parsed.data.issue.number}`,
      eventType: 'issue',
    };
  }

  async fetchItem(accessToken: string, externalId: string): Promise<SyncedItem | null> {
    const parsed = parseGitHubExternalId(externalId);
    if (!parsed) {
      this.logger.warn(`Invalid GitHub external ID format: ${externalId}`);
      return null;
    }

    const octokit = new Octokit({ auth: accessToken });
    const { data: issue } = await octokit.issues.get({
      owner: parsed.owner,
      repo: parsed.repoName,
      issue_number: parsed.number,
    });

    return this.issueFetcher.fetchItem(
      octokit,
      parsed.owner,
      parsed.repoName,
      parsed.repoFullName,
      issue
    );
  }
}
