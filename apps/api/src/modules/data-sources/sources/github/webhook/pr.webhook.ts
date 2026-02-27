import { Injectable, Logger } from '@nestjs/common';

import { Octokit } from '@octokit/rest';

import type { SyncedItem, WebhookEvent } from '../../../../integrations/connector.interface';
import { GitHubPrFetcher } from '../fetcher/pr.fetcher';
import { prWebhookSchema } from '../types';
import { parseGitHubExternalId } from '../utils';

@Injectable()
export class GitHubPrWebhookHandler {
  private readonly logger = new Logger(GitHubPrWebhookHandler.name);

  constructor(private readonly prFetcher: GitHubPrFetcher) {}

  extract(action: string | undefined, body: unknown, repo: string): WebhookEvent | null {
    const parsed = prWebhookSchema.safeParse(body);
    if (!parsed.success) return null;

    let webhookAction: WebhookEvent['action'];
    if (action === 'opened' || action === 'created') webhookAction = 'created';
    else if (action === 'closed') {
      // PR closed: check if merged or just closed
      if (parsed.data.pull_request.merged === false) {
        webhookAction = 'deleted'; // Closed without merge -> remove stale data
      } else {
        webhookAction = 'updated'; // Merged -> re-sync with diff data
      }
    } else if (action === 'deleted') webhookAction = 'deleted';
    else webhookAction = 'updated';

    return {
      action: webhookAction,
      externalId: `${repo}#${parsed.data.pull_request.number}`,
      eventType: 'pull_request',
    };
  }

  async fetchItem(accessToken: string, externalId: string): Promise<SyncedItem | null> {
    const parsed = parseGitHubExternalId(externalId);
    if (!parsed) {
      this.logger.warn(`Invalid GitHub external ID format: ${externalId}`);
      return null;
    }

    const octokit = new Octokit({ auth: accessToken });
    const { data: pr } = await octokit.pulls.get({
      owner: parsed.owner,
      repo: parsed.repoName,
      pull_number: parsed.number,
    });

    return this.prFetcher.fetchItem(
      octokit,
      parsed.owner,
      parsed.repoName,
      parsed.repoFullName,
      pr
    );
  }
}
