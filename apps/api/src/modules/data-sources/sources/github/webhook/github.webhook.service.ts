import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';

import type {
  IntegrationWebhook,
  SyncedItem,
  WebhookEvent,
  WebhookHandlerResult,
} from '../../../../integrations/connector.interface';
import { GitHubOAuthService } from '../github.oauth.service';
import type { GitHubProviderData } from '../types';
import { webhookBasePayloadSchema } from '../types';

import { GitHubDiscussionWebhookHandler } from './discussion.webhook';
import { GitHubIssueWebhookHandler } from './issue.webhook';
import { GitHubPrWebhookHandler } from './pr.webhook';

@Injectable()
export class GitHubWebhookService implements IntegrationWebhook<'GITHUB'> {
  private readonly logger = new Logger(GitHubWebhookService.name);

  constructor(
    private readonly oauth: GitHubOAuthService,
    private readonly issueHandler: GitHubIssueWebhookHandler,
    private readonly prHandler: GitHubPrWebhookHandler,
    private readonly discussionHandler: GitHubDiscussionWebhookHandler
  ) {}

  verify(headers: Record<string, string>, body: unknown, rawBody?: string): boolean {
    return this.oauth.verifyWebhookSignature(headers, body, rawBody);
  }

  handleEvent(
    headers: Record<string, string>,
    body: unknown,
    connections: ReadonlyArray<{
      id: DbId<'Connection'>;
      orgId: DbId<'Org'>;
      providerData: GitHubProviderData;
    }>,
    _rawBody?: string
  ): WebhookHandlerResult {
    const eventType = headers['x-github-event'];
    const basePayload = webhookBasePayloadSchema.safeParse(body);
    const payloadInstallationId = basePayload.success
      ? basePayload.data.installation?.id
      : undefined;

    // App lifecycle events (uninstall / suspend)
    if (eventType === 'installation') {
      const action = basePayload.success ? basePayload.data.action : undefined;
      if (action === 'deleted' || action === 'suspend') {
        const matched = payloadInstallationId
          ? connections.filter((c) => c.providerData.githubInstallationId === payloadInstallationId)
          : [];
        this.logger.log(
          `GitHub App ${action} for installation ${payloadInstallationId}, disconnecting ${matched.length} connection(s)`
        );
        return {
          response: { ok: true },
          disconnectConnections: matched.map((c) => ({ id: c.id, orgId: c.orgId })),
        };
      }
      return { response: { ok: true } };
    }

    // Data events
    const event = this.extractWebhookEvent(headers, body);
    if (!event) return { response: { ok: true } };

    const matchedByInstallation = payloadInstallationId
      ? connections.filter((c) => c.providerData.githubInstallationId === payloadInstallationId)
      : connections;

    const repoFullName = event.externalId.split('#')[0];
    const matched = matchedByInstallation.filter((c) => {
      const selected = c.providerData.selectedRepos ?? [];
      return selected.includes(repoFullName);
    });

    return {
      response: { ok: true },
      syncConnections: matched.map((c) => ({ id: c.id, orgId: c.orgId, event })),
    };
  }

  async fetchItem(
    accessToken: string,
    _providerData: GitHubProviderData,
    event: WebhookEvent
  ): Promise<{ item: SyncedItem | null; deletedExternalId: string | null }> {
    if (event.action === 'deleted') return { item: null, deletedExternalId: event.externalId };

    let item: SyncedItem | null = null;

    try {
      if (event.eventType === 'issue') {
        item = await this.issueHandler.fetchItem(accessToken, event.externalId);
      } else if (event.eventType === 'pull_request') {
        item = await this.prHandler.fetchItem(accessToken, event.externalId);
      } else if (event.eventType === 'discussion') {
        item = await this.discussionHandler.fetchItem(accessToken, event.externalId);
      } else {
        this.logger.warn(`Unknown GitHub eventType: ${event.eventType} for ${event.externalId}`);
      }
    } catch (err) {
      this.logger.warn(
        `Could not fetch GitHub item ${event.externalId} (${event.eventType}): ${err}`
      );
    }

    return { item, deletedExternalId: null };
  }

  private extractWebhookEvent(headers: Record<string, string>, body: unknown): WebhookEvent | null {
    const eventType = headers['x-github-event'];
    if (!eventType) return null;

    const base = webhookBasePayloadSchema.safeParse(body);
    if (!base.success) return null;

    const repo = base.data.repository?.full_name;
    if (!repo) return null;

    const action = base.data.action;

    if (eventType === 'issues' || eventType === 'issue_comment') {
      return this.issueHandler.extract(action, body, repo);
    }
    if (eventType === 'pull_request' || eventType === 'pull_request_review_comment') {
      return this.prHandler.extract(action, body, repo);
    }
    if (eventType === 'discussion' || eventType === 'discussion_comment') {
      return this.discussionHandler.extract(action, body, repo);
    }

    return null;
  }
}
