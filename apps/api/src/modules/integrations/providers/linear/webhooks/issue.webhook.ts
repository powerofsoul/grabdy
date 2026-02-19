import { Injectable, Logger } from '@nestjs/common';

import { LinearClient, PaginationOrderBy } from '@linear/sdk';

import type { SyncedItem, WebhookEvent } from '../../../connector.interface';
import {
  type IssueFields,
  buildSyncedItemFromIssue,
  linearWebhookBodySchema,
} from '../linear.utils';

@Injectable()
export class LinearIssueWebhook {
  private readonly logger = new Logger(LinearIssueWebhook.name);

  extractEvent(body: unknown): WebhookEvent | null {
    const parsed = linearWebhookBodySchema.safeParse(body);
    if (!parsed.success) return null;

    const typedPayload = parsed.data;
    const actionStr = typedPayload.action;
    const typeStr = typedPayload.type;

    let action: WebhookEvent['action'];
    if (actionStr === 'create') action = 'created';
    else if (actionStr === 'update') action = 'updated';
    else if (actionStr === 'remove') action = 'deleted';
    else return null;

    // For comments, the relevant external ID is the parent issue
    let externalId: string | undefined;
    if (typeStr === 'Comment') {
      externalId = typedPayload.data?.issueId;
    } else if (typeStr === 'Issue') {
      externalId = typedPayload.data?.id;
    }

    if (!externalId) return null;

    return { action, externalId };
  }

  async fetchItem(client: LinearClient, linearIssueId: string): Promise<SyncedItem | null> {
    const fields = await this.fetchIssueWithRelations(client, linearIssueId);
    if (!fields) {
      this.logger.warn(`Could not fetch Linear issue ${linearIssueId}`);
      return null;
    }
    return buildSyncedItemFromIssue(fields);
  }

  async fetchUpdatedItems(
    client: LinearClient,
    since: string
  ): Promise<{ items: SyncedItem[]; hasMore: boolean; maxUpdatedAt: string | null }> {
    const filter = { updatedAt: { gt: new Date(since) } };

    const issuesConnection = await client.issues({
      first: 50,
      orderBy: PaginationOrderBy.UpdatedAt,
      filter,
    });

    const items: SyncedItem[] = [];
    let maxUpdatedAt: string | null = null;

    for (const issue of issuesConnection.nodes) {
      const fields = await this.fetchIssueWithRelations(client, issue.id);
      if (!fields) continue;

      items.push(buildSyncedItemFromIssue(fields));

      const updatedAtStr = fields.updatedAt.toISOString();
      if (!maxUpdatedAt || updatedAtStr > maxUpdatedAt) {
        maxUpdatedAt = updatedAtStr;
      }
    }

    return { items, hasMore: issuesConnection.pageInfo.hasNextPage, maxUpdatedAt };
  }

  private async fetchIssueWithRelations(
    client: LinearClient,
    linearIssueId: string
  ): Promise<IssueFields | null> {
    const issue = await client.issue(linearIssueId);
    if (!issue) return null;

    const [
      stateResult,
      assigneeResult,
      teamResult,
      labelsResult,
      parentResult,
      childrenResult,
      commentsResult,
    ] = await Promise.all([
      issue.state,
      issue.assignee,
      issue.team,
      issue.labels(),
      issue.parent,
      issue.children(),
      issue.comments(),
    ]);

    const commentNodes = await Promise.all(
      commentsResult.nodes.map(async (c) => {
        const user = await c.user;
        return {
          id: c.id,
          body: c.body,
          user: user ? { name: user.name } : undefined,
          createdAt: c.createdAt,
          url: c.url,
        };
      })
    );

    const childNodes = await Promise.all(
      childrenResult.nodes.map(async (child) => {
        const childState = await child.state;
        return {
          identifier: child.identifier,
          title: child.title,
          state: childState ? { name: childState.name } : undefined,
        };
      })
    );

    return {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description ?? undefined,
      url: issue.url,
      updatedAt: issue.updatedAt,
      priority: issue.priority,
      priorityLabel: issue.priorityLabel,
      state: stateResult ? { name: stateResult.name } : undefined,
      assignee: assigneeResult ? { name: assigneeResult.name } : undefined,
      team: teamResult ? { name: teamResult.name } : undefined,
      labels: { nodes: labelsResult.nodes.map((l) => ({ name: l.name })) },
      parent: parentResult
        ? { identifier: parentResult.identifier, title: parentResult.title }
        : undefined,
      children: { nodes: childNodes },
      comments: { nodes: commentNodes },
    };
  }
}
