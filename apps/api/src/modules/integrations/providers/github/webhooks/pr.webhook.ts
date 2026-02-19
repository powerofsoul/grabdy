import { Injectable, Logger } from '@nestjs/common';

import type { Octokit } from '@octokit/rest';

import type { SyncedItem, WebhookEvent } from '../../../connector.interface';
import {
  type GitHubPR,
  type MessageList,
  buildContextHeader,
  buildSyncedItem,
  extractLabels,
  formatGitHubDate,
  prWebhookSchema,
} from '../github.utils';

@Injectable()
export class GitHubPrWebhook {
  private readonly logger = new Logger(GitHubPrWebhook.name);

  extractEvent(
    action: string | undefined,
    body: unknown,
    repo: string
  ): WebhookEvent | null {
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
    };
  }

  async fetchItem(
    octokit: Octokit,
    owner: string,
    repoName: string,
    repoFullName: string,
    pr: GitHubPR
  ): Promise<SyncedItem> {
    const labels = extractLabels(pr.labels);
    const assignees = (pr.assignees ?? []).map((a) => a.login);
    const author = pr.user?.login ?? 'unknown';
    const merged = pr.merged_at !== null && pr.merged_at !== undefined;
    const state = merged ? 'merged' : pr.state;

    const header = buildContextHeader({
      repo: repoFullName,
      number: pr.number,
      title: pr.title,
      kind: 'PR',
      state,
      author,
      labels,
      assignees,
      branches: { head: pr.head.ref, base: pr.base.ref },
    });

    const comments = await this.fetchIssueComments(
      octokit,
      owner,
      repoName,
      repoFullName,
      pr.number,
      pr.title
    );
    const reviewComments = await this.fetchReviewComments(
      octokit,
      owner,
      repoName,
      repoFullName,
      pr.number,
      pr.title
    );

    // Fetch diff files for merged PRs
    const diffMessages: MessageList = merged
      ? await this.fetchPRDiffMessages(octokit, owner, repoName, repoFullName, pr.number, pr.title)
      : [];

    return buildSyncedItem(
      'pull_request',
      repoFullName,
      pr.number,
      pr.title,
      pr.html_url,
      header,
      pr.body,
      [...comments, ...reviewComments, ...diffMessages],
      {
        state,
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
    since: string | undefined
  ): Promise<{ items: SyncedItem[]; hasMore: boolean; maxUpdatedAt: string | null }> {
    const items: SyncedItem[] = [];
    let maxUpdatedAt: string | null = null;

    try {
      const { data: prs } = await octokit.pulls.list({
        owner,
        repo: repoName,
        state: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: 50,
      });
      const filtered = since ? prs.filter((pr) => pr.updated_at > since) : prs;
      for (const pr of filtered) {
        items.push(await this.fetchItem(octokit, owner, repoName, repoFullName, pr));
        if (!maxUpdatedAt || pr.updated_at > maxUpdatedAt) maxUpdatedAt = pr.updated_at;
      }
      return { items, hasMore: filtered.length >= 50, maxUpdatedAt };
    } catch (err) {
      this.logger.warn(`Failed to fetch PRs for ${repoFullName}: ${err}`);
      return { items, hasMore: false, maxUpdatedAt };
    }
  }

  private async fetchIssueComments(
    octokit: Octokit,
    owner: string,
    repoName: string,
    repoFullName: string,
    number: number,
    title: string
  ): Promise<MessageList> {
    try {
      const { data: comments } = await octokit.issues.listComments({
        owner,
        repo: repoName,
        issue_number: number,
        per_page: 100,
      });
      return comments.map((c) => ({
        content: `Comment on ${repoFullName}#${number} PR (${title})\n[${formatGitHubDate(c.created_at)}] ${c.user?.login ?? 'unknown'}: ${c.body ?? ''}`,
        metadata: {
          type: 'GITHUB' as const,
          githubItemType: 'pull_request' as const,
          githubCommentId: String(c.id),
        },
        sourceUrl: c.html_url,
      }));
    } catch (err) {
      this.logger.warn(`Failed to fetch comments for ${repoFullName}#${number}: ${err}`);
      return [];
    }
  }

  private async fetchReviewComments(
    octokit: Octokit,
    owner: string,
    repoName: string,
    repoFullName: string,
    number: number,
    title: string
  ): Promise<MessageList> {
    try {
      const { data: comments } = await octokit.pulls.listReviewComments({
        owner,
        repo: repoName,
        pull_number: number,
        per_page: 100,
      });
      return comments.map((c) => ({
        content: `Review comment on ${repoFullName}#${number} PR (${title}) at ${c.path}\n[${formatGitHubDate(c.created_at)}] ${c.user?.login ?? 'unknown'}: ${c.body}`,
        metadata: {
          type: 'GITHUB' as const,
          githubItemType: 'pull_request' as const,
          githubCommentId: String(c.id),
        },
        sourceUrl: c.html_url,
      }));
    } catch (err) {
      this.logger.warn(`Failed to fetch review comments for ${repoFullName}#${number}: ${err}`);
      return [];
    }
  }

  private async fetchPRDiffMessages(
    octokit: Octokit,
    owner: string,
    repoName: string,
    repoFullName: string,
    pullNumber: number,
    title: string
  ): Promise<MessageList> {
    const MAX_PER_FILE_BYTES = 100_000;
    const MAX_TOTAL_BYTES = 500_000;

    try {
      const { data: files } = await octokit.pulls.listFiles({
        owner,
        repo: repoName,
        pull_number: pullNumber,
        per_page: 100,
      });

      const messages: MessageList = [];
      let totalBytes = 0;

      for (const file of files) {
        if (!file.patch) continue;

        let patch = file.patch;
        if (patch.length > MAX_PER_FILE_BYTES) {
          patch = patch.slice(0, MAX_PER_FILE_BYTES) + '\n... (truncated)';
        }

        if (totalBytes + patch.length > MAX_TOTAL_BYTES) break;
        totalBytes += patch.length;

        const statusLabel =
          file.status === 'added'
            ? 'new file'
            : file.status === 'removed'
              ? 'deleted'
              : file.status === 'renamed'
                ? `renamed from ${file.previous_filename}`
                : 'modified';

        messages.push({
          content: `Diff for ${repoFullName}#${pullNumber} PR (${title})\nFile: ${file.filename} (${statusLabel}, +${file.additions} -${file.deletions})\n\n${patch}`,
          metadata: {
            type: 'GITHUB' as const,
            githubItemType: 'pull_request' as const,
            githubCommentId: null,
          },
          sourceUrl: `https://github.com/${repoFullName}/pull/${pullNumber}/files#diff-${file.sha}`,
        });
      }

      return messages;
    } catch (err) {
      this.logger.warn(`Failed to fetch diff for ${repoFullName}#${pullNumber}: ${err}`);
      return [];
    }
  }
}
