import { Injectable, Logger } from '@nestjs/common';

import type { Octokit } from '@octokit/rest';

import type { SyncedItem, WebhookEvent } from '../../../connector.interface';
import {
  type GitHubIssue,
  type GitHubItemType,
  type MessageList,
  buildContextHeader,
  buildSyncedItem,
  extractLabels,
  formatGitHubDate,
  issueWebhookSchema,
} from '../github.utils';

@Injectable()
export class GitHubIssueWebhook {
  private readonly logger = new Logger(GitHubIssueWebhook.name);

  extractEvent(
    action: string | undefined,
    body: unknown,
    repo: string
  ): WebhookEvent | null {
    const parsed = issueWebhookSchema.safeParse(body);
    if (!parsed.success) return null;

    let webhookAction: WebhookEvent['action'];
    if (action === 'opened' || action === 'created') webhookAction = 'created';
    else if (action === 'deleted') webhookAction = 'deleted';
    else webhookAction = 'updated';

    return {
      action: webhookAction,
      externalId: `${repo}#${parsed.data.issue.number}`,
    };
  }

  async fetchItem(
    octokit: Octokit,
    owner: string,
    repoName: string,
    repoFullName: string,
    issue: GitHubIssue
  ): Promise<SyncedItem> {
    const labels = extractLabels(issue.labels);
    const assignees = (issue.assignees ?? []).map((a) => a.login);
    const author = issue.user?.login ?? 'unknown';

    const header = buildContextHeader({
      repo: repoFullName,
      number: issue.number,
      title: issue.title,
      state: issue.state,
      author,
      labels,
      assignees,
    });

    const comments = await this.fetchIssueComments(
      octokit,
      owner,
      repoName,
      repoFullName,
      issue.number,
      issue.title,
      'issue'
    );

    return buildSyncedItem(
      'issue',
      repoFullName,
      issue.number,
      issue.title,
      issue.html_url,
      header,
      issue.body,
      comments,
      {
        state: issue.state,
        labels: labels.length > 0 ? labels : null,
        assignees: assignees.length > 0 ? assignees : null,
      }
    );
  }

  async fetchUpdatedItems(
    octokit: Octokit,
    owner: string,
    repoName: string,
    repoFullName: string,
    since: string
  ): Promise<{ items: SyncedItem[]; hasMore: boolean; maxUpdatedAt: string | null }> {
    const items: SyncedItem[] = [];
    let maxUpdatedAt: string | null = null;

    try {
      const { data: issues } = await octokit.issues.listForRepo({
        owner,
        repo: repoName,
        state: 'all',
        sort: 'updated',
        direction: 'desc',
        since,
        per_page: 50,
      });
      for (const issue of issues) {
        if (issue.pull_request) continue;
        items.push(await this.fetchItem(octokit, owner, repoName, repoFullName, issue));
        if (!maxUpdatedAt || issue.updated_at > maxUpdatedAt) maxUpdatedAt = issue.updated_at;
      }
      return { items, hasMore: issues.length >= 50, maxUpdatedAt };
    } catch (err) {
      this.logger.warn(`Failed to fetch issues for ${repoFullName}: ${err}`);
      return { items, hasMore: false, maxUpdatedAt };
    }
  }

  private async fetchIssueComments(
    octokit: Octokit,
    owner: string,
    repoName: string,
    repoFullName: string,
    number: number,
    title: string,
    itemType: GitHubItemType
  ): Promise<MessageList> {
    try {
      const { data: comments } = await octokit.issues.listComments({
        owner,
        repo: repoName,
        issue_number: number,
        per_page: 100,
      });
      const kind = itemType === 'pull_request' ? ' PR' : '';
      return comments.map((c) => ({
        content: `Comment on ${repoFullName}#${number}${kind} (${title})\n[${formatGitHubDate(c.created_at)}] ${c.user?.login ?? 'unknown'}: ${c.body ?? ''}`,
        metadata: {
          type: 'GITHUB' as const,
          githubItemType: itemType,
          githubCommentId: String(c.id),
        },
        sourceUrl: c.html_url,
      }));
    } catch (err) {
      this.logger.warn(`Failed to fetch comments for ${repoFullName}#${number}: ${err}`);
      return [];
    }
  }
}
