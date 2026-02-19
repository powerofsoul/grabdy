import { Injectable, Logger } from '@nestjs/common';

import { graphql } from '@octokit/graphql';

import type { SyncedItem, WebhookEvent } from '../../../connector.interface';
import {
  DISCUSSION_FIELDS,
  type DiscussionNode,
  buildDiscussionItem,
  discussionWebhookSchema,
} from '../github.utils';

@Injectable()
export class GitHubDiscussionWebhook {
  private readonly logger = new Logger(GitHubDiscussionWebhook.name);

  extractEvent(
    action: string | undefined,
    body: unknown,
    repo: string
  ): WebhookEvent | null {
    const parsed = discussionWebhookSchema.safeParse(body);
    if (!parsed.success) return null;

    let webhookAction: WebhookEvent['action'];
    if (action === 'created') webhookAction = 'created';
    else if (action === 'deleted') webhookAction = 'deleted';
    else webhookAction = 'updated';

    return {
      action: webhookAction,
      externalId: `${repo}#${parsed.data.discussion.number}`,
    };
  }

  async fetchItem(
    accessToken: string,
    owner: string,
    repoName: string,
    repoFullName: string,
    number: number
  ): Promise<SyncedItem | null> {
    const gql = graphql.defaults({ headers: { authorization: `token ${accessToken}` } });

    const result = await gql<{ repository: { discussion: DiscussionNode | null } }>(
      `query ($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          discussion(number: $number) { ${DISCUSSION_FIELDS} }
        }
      }`,
      { owner, repo: repoName, number }
    );

    const discussion = result.repository.discussion;
    return discussion ? buildDiscussionItem(discussion, repoFullName) : null;
  }

  async fetchUpdatedItems(
    accessToken: string,
    owner: string,
    repoName: string,
    repoFullName: string,
    since: string | undefined
  ): Promise<Array<{ item: SyncedItem; updatedAt: string }>> {
    const gql = graphql.defaults({ headers: { authorization: `token ${accessToken}` } });

    const result = await gql<{ repository: { discussions: { nodes: DiscussionNode[] } } }>(
      `query ($owner: String!, $repo: String!, $first: Int!) {
        repository(owner: $owner, name: $repo) {
          discussions(first: $first, orderBy: {field: UPDATED_AT, direction: DESC}) {
            nodes { ${DISCUSSION_FIELDS} }
          }
        }
      }`,
      { owner, repo: repoName, first: 50 }
    );

    return result.repository.discussions.nodes
      .filter((d) => !since || d.updatedAt > since)
      .map((d) => ({ item: buildDiscussionItem(d, repoFullName), updatedAt: d.updatedAt }));
  }
}
