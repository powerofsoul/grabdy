import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import { Octokit } from '@octokit/rest';

import type {
  IntegrationSync,
  SyncedItem,
  SyncResult,
} from '../../../integrations/connector.interface';
import { getInitialSyncSince } from '../../../integrations/integrations.constants';

import { GitHubDiscussionFetcher } from './fetcher/discussion.fetcher';
import { GitHubIssueFetcher } from './fetcher/issue.fetcher';
import { GitHubPrFetcher } from './fetcher/pr.fetcher';
import type { GitHubProviderData } from './types';

@Injectable()
export class GitHubSyncService implements IntegrationSync<'GITHUB'> {
  private readonly logger = new Logger(GitHubSyncService.name);

  constructor(
    private readonly issueFetcher: GitHubIssueFetcher,
    private readonly prFetcher: GitHubPrFetcher,
    private readonly discussionFetcher: GitHubDiscussionFetcher
  ) {}

  async sync(
    accessToken: string,
    providerData: GitHubProviderData,
    _context: { connectionId: DbId<'Connection'>; orgId: DbId<'Org'> }
  ): Promise<SyncResult> {
    const octokit = new Octokit({ auth: accessToken });
    const since = providerData.lastSyncedAt ?? getInitialSyncSince();

    const items: SyncedItem[] = [];
    let maxUpdatedAt = providerData.lastSyncedAt;
    let hasMore = false;

    const { data: reposResponse } = await octokit.apps.listReposAccessibleToInstallation({
      per_page: 100,
    });

    for (const repo of reposResponse.repositories) {
      const owner = repo.owner.login;
      const repoName = repo.name;
      const repoFullName = repo.full_name;

      // Issues
      const issueResult = await this.issueFetcher.fetchUpdatedItems(
        octokit,
        owner,
        repoName,
        repoFullName,
        since
      );
      items.push(...issueResult.items);
      if (issueResult.hasMore) hasMore = true;
      if (issueResult.maxUpdatedAt && (!maxUpdatedAt || issueResult.maxUpdatedAt > maxUpdatedAt)) {
        maxUpdatedAt = issueResult.maxUpdatedAt;
      }

      // Pull requests
      const prResult = await this.prFetcher.fetchUpdatedItems(
        octokit,
        owner,
        repoName,
        repoFullName,
        since
      );
      items.push(...prResult.items);
      if (prResult.hasMore) hasMore = true;
      if (prResult.maxUpdatedAt && (!maxUpdatedAt || prResult.maxUpdatedAt > maxUpdatedAt)) {
        maxUpdatedAt = prResult.maxUpdatedAt;
      }

      // Discussions (GraphQL)
      try {
        const discussions = await this.discussionFetcher.fetchUpdatedItems(
          accessToken,
          owner,
          repoName,
          repoFullName,
          since
        );
        for (const d of discussions) {
          items.push(d.item);
          if (!maxUpdatedAt || d.updatedAt > maxUpdatedAt) maxUpdatedAt = d.updatedAt;
        }
      } catch (err) {
        this.logger.debug(`No discussions for ${repoFullName}: ${err}`);
      }
    }

    return {
      type: 'items',
      items,
      deletedExternalIds: [],
      updatedProviderData: { ...providerData, lastSyncedAt: maxUpdatedAt },
      hasMore,
    };
  }
}
