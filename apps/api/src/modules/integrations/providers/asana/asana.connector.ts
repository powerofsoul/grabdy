import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

import { InjectEnv } from '../../../../config/env.config';
import { IntegrationProvider } from '../../../../db/enums';
import {
  IntegrationConnector,
  type AccountInfo,
  type OAuthTokens,
  type RateLimitConfig,
  type SyncCursor,
  type SyncedItem,
  type SyncResult,
  type WebhookEvent,
  type WebhookInfo,
} from '../../connector.interface';

const ASANA_AUTH_URL = 'https://app.asana.com/-/oauth_authorize';
const ASANA_TOKEN_URL = 'https://app.asana.com/-/oauth_token';
const ASANA_API_URL = 'https://app.asana.com/api/1.0';

// --- Asana API response types ---

interface AsanaTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface AsanaWorkspace {
  gid: string;
  name: string;
}

interface AsanaUserResponse {
  data?: {
    gid?: string;
    name?: string;
    workspaces?: AsanaWorkspace[];
  };
  errors?: Array<{ message: string }>;
}

interface AsanaProject {
  gid: string;
  name: string;
}

interface AsanaProjectsResponse {
  data?: AsanaProject[];
  next_page?: {
    offset?: string;
  } | null;
  errors?: Array<{ message: string }>;
}

interface AsanaTask {
  gid: string;
  name: string;
  notes: string;
  completed: boolean;
  modified_at: string;
}

interface AsanaTasksResponse {
  data?: AsanaTask[];
  next_page?: {
    offset?: string;
  } | null;
  errors?: Array<{ message: string }>;
}

interface AsanaStory {
  type: string;
  text: string;
  created_by?: {
    name?: string;
  };
}

interface AsanaStoriesResponse {
  data?: AsanaStory[];
  errors?: Array<{ message: string }>;
}

interface AsanaSyncCursor {
  modifiedSince: string;
}

function isAsanaSyncCursor(value: unknown): value is AsanaSyncCursor {
  if (!value || typeof value !== 'object') return false;
  if (!('modifiedSince' in value)) return false;
  return typeof value.modifiedSince === 'string';
}

@Injectable()
export class AsanaConnector extends IntegrationConnector {
  readonly provider = IntegrationProvider.ASANA;
  readonly rateLimits: RateLimitConfig = {
    maxRequestsPerMinute: 150,
    maxRequestsPerHour: 9000,
  };
  readonly supportsWebhooks = true;

  private readonly logger = new Logger(AsanaConnector.name);

  constructor(
    @InjectEnv('asanaClientId') private readonly clientId: string,
    @InjectEnv('asanaClientSecret') private readonly clientSecret: string,
  ) {
    super();
  }

  getAuthUrl(_orgId: string, state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    });
    return `${ASANA_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const response = await fetch(ASANA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    const data: AsanaTokenResponse = await response.json();

    if (data.error || !data.access_token) {
      throw new Error(`Asana OAuth error: ${data.error_description ?? data.error ?? 'Unknown error'}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      scopes: ['default'],
    };
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch(ASANA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    const data: AsanaTokenResponse = await response.json();

    if (data.error || !data.access_token) {
      throw new Error(`Asana token refresh error: ${data.error_description ?? data.error ?? 'Unknown error'}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      scopes: ['default'],
    };
  }

  async getAccountInfo(accessToken: string): Promise<AccountInfo> {
    const response = await fetch(`${ASANA_API_URL}/users/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data: AsanaUserResponse = await response.json();

    if (data.errors?.length) {
      const errorMsg = data.errors.map((e) => e.message).join(', ');
      throw new Error(`Asana users/me error: ${errorMsg}`);
    }

    if (!data.data) {
      throw new Error('Asana users/me returned no data');
    }

    // Return the first workspace as the account info
    const workspaces = data.data.workspaces;
    if (!workspaces || workspaces.length === 0) {
      throw new Error('Asana user has no workspaces');
    }

    const firstWorkspace = workspaces[0];

    return {
      id: firstWorkspace.gid,
      name: firstWorkspace.name,
    };
  }

  async registerWebhook(
    accessToken: string,
    config: Record<string, unknown>,
  ): Promise<WebhookInfo | null> {
    // Asana webhooks require X-Hook-Secret handshake
    // The webhook target URL receives the X-Hook-Secret header and must echo it back
    const resource = typeof config.resource === 'string' ? config.resource : undefined;
    const target = typeof config.targetUrl === 'string' ? config.targetUrl : undefined;

    if (!resource || !target) {
      this.logger.warn('Asana webhook registration requires resource and targetUrl in config');
      return null;
    }

    const response = await fetch(`${ASANA_API_URL}/webhooks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          resource,
          target,
        },
      }),
    });

    const responseData: {
      data?: { gid?: string };
      errors?: Array<{ message: string }>;
    } = await response.json();

    if (responseData.errors?.length) {
      const errorMsg = responseData.errors.map((e) => e.message).join(', ');
      throw new Error(`Asana webhook registration error: ${errorMsg}`);
    }

    const webhookGid = responseData.data?.gid;
    if (!webhookGid) {
      throw new Error('Asana webhook registration returned no gid');
    }

    // The X-Hook-Secret is provided via the handshake, not in this response
    return {
      webhookId: webhookGid,
      secret: null,
    };
  }

  async deregisterWebhook(accessToken: string, webhookId: string): Promise<void> {
    const response = await fetch(`${ASANA_API_URL}/webhooks/${webhookId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      this.logger.warn(`Failed to deregister Asana webhook ${webhookId}: ${response.status}`);
    }
  }

  parseWebhook(
    headers: Record<string, string>,
    body: unknown,
    secret: string | null,
  ): WebhookEvent | null {
    // Asana sends X-Hook-Secret for handshake - this is handled at the controller level
    // For actual events, verify X-Hook-Signature
    const hookSignature = headers['x-hook-signature'];
    if (!hookSignature || !secret) return null;

    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    const expectedSignature = createHmac('sha256', secret)
      .update(bodyString)
      .digest('hex');

    const sigBuffer = Buffer.from(hookSignature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      this.logger.warn('Asana webhook signature verification failed');
      return null;
    }

    if (!body || typeof body !== 'object') return null;

    const events = 'events' in body && Array.isArray(body.events) ? body.events : [];
    if (events.length === 0) return null;

    // Process the first event (batch handling would require returning multiple events)
    const firstEvent: unknown = events[0];
    if (!firstEvent || typeof firstEvent !== 'object') return null;

    const eventAction = 'action' in firstEvent && typeof firstEvent.action === 'string'
      ? firstEvent.action
      : undefined;
    const resource = 'resource' in firstEvent && typeof firstEvent.resource === 'object' && firstEvent.resource !== null
      ? firstEvent.resource
      : undefined;

    if (!resource || !('gid' in resource) || typeof resource.gid !== 'string') return null;

    let action: WebhookEvent['action'];
    if (eventAction === 'added' || eventAction === 'changed') action = 'updated';
    else if (eventAction === 'deleted' || eventAction === 'removed') action = 'deleted';
    else action = 'updated';

    return {
      action,
      externalId: resource.gid,
    };
  }

  async sync(
    accessToken: string,
    config: Record<string, unknown>,
    cursor: SyncCursor | null,
  ): Promise<SyncResult> {
    const modifiedSince = isAsanaSyncCursor(cursor) ? cursor.modifiedSince : undefined;

    const workspaceGid = typeof config.workspaceGid === 'string' ? config.workspaceGid : undefined;
    if (!workspaceGid) {
      throw new Error('Asana sync requires workspaceGid in config');
    }

    // Fetch all projects in the workspace
    const projects = await this.fetchProjects(accessToken, workspaceGid);
    const items: SyncedItem[] = [];
    let latestModified = modifiedSince ?? '';

    for (const project of projects) {
      const tasks = await this.fetchTasks(accessToken, project.gid, modifiedSince);

      for (const task of tasks) {
        const stories = await this.fetchTaskStories(accessToken, task.gid);

        const commentLines = stories
          .filter((story) => story.type === 'comment')
          .map((story) => {
            const author = story.created_by?.name ?? 'Unknown';
            return `${author}: ${story.text}`;
          });

        const contentParts = [task.name];
        if (task.notes) {
          contentParts.push('', task.notes);
        }
        if (commentLines.length > 0) {
          contentParts.push('', 'Comments:', ...commentLines);
        }

        items.push({
          externalId: task.gid,
          title: task.name,
          content: contentParts.join('\n'),
          sourceUrl: `https://app.asana.com/0/${project.gid}/${task.gid}`,
          metadata: {
            projectGid: project.gid,
            projectName: project.name,
            completed: task.completed,
            modifiedAt: task.modified_at,
          },
        });

        if (task.modified_at > latestModified) {
          latestModified = task.modified_at;
        }
      }
    }

    return {
      items,
      deletedExternalIds: [],
      cursor: latestModified ? { modifiedSince: latestModified } : null,
      hasMore: false,
    };
  }

  private async fetchProjects(
    accessToken: string,
    workspaceGid: string,
  ): Promise<AsanaProject[]> {
    const projects: AsanaProject[] = [];
    let offset: string | undefined;

    do {
      const params = new URLSearchParams({
        workspace: workspaceGid,
        limit: '100',
      });
      if (offset) {
        params.set('offset', offset);
      }

      const response = await fetch(`${ASANA_API_URL}/projects?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data: AsanaProjectsResponse = await response.json();

      if (data.errors?.length) {
        const errorMsg = data.errors.map((e) => e.message).join(', ');
        throw new Error(`Asana projects error: ${errorMsg}`);
      }

      if (data.data) {
        projects.push(...data.data);
      }

      offset = data.next_page?.offset;
    } while (offset);

    return projects;
  }

  private async fetchTasks(
    accessToken: string,
    projectGid: string,
    modifiedSince: string | undefined,
  ): Promise<AsanaTask[]> {
    const tasks: AsanaTask[] = [];
    let offset: string | undefined;

    do {
      const params = new URLSearchParams({
        project: projectGid,
        opt_fields: 'name,notes,completed,modified_at',
        limit: '100',
      });
      if (modifiedSince) {
        params.set('modified_since', modifiedSince);
      }
      if (offset) {
        params.set('offset', offset);
      }

      const response = await fetch(`${ASANA_API_URL}/tasks?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data: AsanaTasksResponse = await response.json();

      if (data.errors?.length) {
        const errorMsg = data.errors.map((e) => e.message).join(', ');
        throw new Error(`Asana tasks error: ${errorMsg}`);
      }

      if (data.data) {
        tasks.push(...data.data);
      }

      offset = data.next_page?.offset;
    } while (offset);

    return tasks;
  }

  private async fetchTaskStories(
    accessToken: string,
    taskGid: string,
  ): Promise<AsanaStory[]> {
    const response = await fetch(
      `${ASANA_API_URL}/tasks/${taskGid}/stories?opt_fields=text,type,created_by.name`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    const data: AsanaStoriesResponse = await response.json();

    if (data.errors?.length) {
      this.logger.warn(`Asana stories error for task ${taskGid}: ${data.errors.map((e) => e.message).join(', ')}`);
      return [];
    }

    return data.data ?? [];
  }
}
