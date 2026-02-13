import { Injectable, Logger } from '@nestjs/common';

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

const FIGMA_AUTH_URL = 'https://www.figma.com/oauth';
const FIGMA_TOKEN_URL = 'https://www.figma.com/api/oauth/token';
const FIGMA_REFRESH_URL = 'https://www.figma.com/api/oauth/refresh';
const FIGMA_API_URL = 'https://api.figma.com';

// ─── Rate limit: Figma Starter is 10-50/min ────────────────────────────

const THROTTLE_DELAY_MS = 2000; // Conservative: ~30 req/min

// ─── API response interfaces ───────────────────────────────────────────

interface FigmaTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: boolean;
  status?: number;
  message?: string;
}

interface FigmaUser {
  id: string;
  handle: string;
  email: string;
  img_url: string;
}

interface FigmaMeResponse {
  id: string;
  handle: string;
  email: string;
  img_url: string;
}

interface FigmaProject {
  id: number;
  name: string;
}

interface FigmaTeamProjectsResponse {
  name: string;
  projects: FigmaProject[];
}

interface FigmaProjectFile {
  key: string;
  name: string;
  thumbnail_url: string;
  last_modified: string;
}

interface FigmaProjectFilesResponse {
  name: string;
  files: FigmaProjectFile[];
}

interface FigmaComponent {
  key: string;
  name: string;
  description: string;
}

interface FigmaCanvas {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
}

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
}

interface FigmaFileResponse {
  name: string;
  lastModified: string;
  document: {
    id: string;
    name: string;
    type: string;
    children: FigmaCanvas[];
  };
  components: Record<string, FigmaComponent>;
}

interface FigmaComment {
  id: string;
  message: string;
  created_at: string;
  user: { handle: string; id: string };
  resolved_at: string | null;
  order_id: string;
}

interface FigmaCommentsResponse {
  comments: FigmaComment[];
}

interface FigmaWebhookCreateResponse {
  id: string;
  team_id: string;
  event_type: string;
  endpoint: string;
  passcode: string;
  status: string;
}

interface FigmaWebhookPayload {
  event_type?: string;
  file_key?: string;
  file_name?: string;
  timestamp?: string;
  passcode?: string;
}

// ─── Type guard ────────────────────────────────────────────────────────

function isFigmaWebhookPayload(value: unknown): value is FigmaWebhookPayload {
  if (!value || typeof value !== 'object') return false;
  return 'event_type' in value && 'file_key' in value;
}

// ─── Cursor shape ──────────────────────────────────────────────────────

interface FigmaSyncCursor extends SyncCursor {
  lastSyncTimestamp: number;
}

// ─── Connector ─────────────────────────────────────────────────────────

@Injectable()
export class FigmaConnector extends IntegrationConnector {
  readonly provider = IntegrationProvider.FIGMA;
  readonly rateLimits: RateLimitConfig = {
    maxRequestsPerMinute: 30, // Conservative for Starter plan
    maxRequestsPerHour: 1800,
  };
  readonly supportsWebhooks = true;

  private readonly logger = new Logger(FigmaConnector.name);

  constructor(
    @InjectEnv('figmaClientId') private readonly clientId: string,
    @InjectEnv('figmaClientSecret') private readonly clientSecret: string,
  ) {
    super();
  }

  // ── OAuth ──────────────────────────────────────────────────────────

  getAuthUrl(_orgId: string, state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: 'files:read',
      state,
      response_type: 'code',
    });
    return `${FIGMA_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const response = await fetch(FIGMA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        code,
        grant_type: 'authorization_code',
      }),
    });

    const data: FigmaTokenResponse = await response.json();

    if (data.error || !data.access_token) {
      throw new Error(`Figma OAuth error: ${data.message ?? 'Unknown error'}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      scopes: ['files:read'],
    };
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch(FIGMA_REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    const data: FigmaTokenResponse = await response.json();

    if (data.error || !data.access_token) {
      throw new Error(`Figma token refresh error: ${data.message ?? 'Unknown error'}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      scopes: ['files:read'],
    };
  }

  // ── Account info ───────────────────────────────────────────────────

  async getAccountInfo(accessToken: string): Promise<AccountInfo> {
    const response = await fetch(`${FIGMA_API_URL}/v1/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
    }

    const data: FigmaMeResponse = await response.json();
    return {
      id: data.id,
      name: data.handle,
    };
  }

  // ── Webhooks ───────────────────────────────────────────────────────

  async registerWebhook(
    accessToken: string,
    config: Record<string, unknown>,
  ): Promise<WebhookInfo | null> {
    const teamId = config['teamId'];
    const callbackUrl = config['callbackUrl'];

    if (typeof teamId !== 'string' || typeof callbackUrl !== 'string') {
      this.logger.warn('Missing teamId or callbackUrl in webhook config');
      return null;
    }

    const response = await fetch(`${FIGMA_API_URL}/v2/webhooks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'FILE_UPDATE',
        team_id: teamId,
        endpoint: callbackUrl,
        passcode: '', // Figma generates the passcode
        description: 'Grabdy integration webhook',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Figma webhook registration failed: ${response.status} ${text}`);
    }

    const hook: FigmaWebhookCreateResponse = await response.json();
    return {
      webhookId: hook.id,
      secret: hook.passcode,
    };
  }

  async deregisterWebhook(accessToken: string, webhookId: string): Promise<void> {
    const response = await fetch(`${FIGMA_API_URL}/v2/webhooks/${webhookId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Figma webhook deletion failed: ${response.status}`);
    }
  }

  parseWebhook(
    _headers: Record<string, string>,
    body: unknown,
    secret: string | null,
  ): WebhookEvent | null {
    if (!isFigmaWebhookPayload(body)) return null;

    // Verify passcode if we have one
    if (secret && body.passcode !== secret) {
      this.logger.warn('Figma webhook passcode mismatch');
      return null;
    }

    const { event_type, file_key } = body;
    if (!event_type || !file_key) return null;

    let eventAction: WebhookEvent['action'];
    if (event_type === 'FILE_UPDATE') eventAction = 'updated';
    else if (event_type === 'FILE_DELETE') eventAction = 'deleted';
    else return null;

    return {
      action: eventAction,
      externalId: file_key,
    };
  }

  // ── Sync ───────────────────────────────────────────────────────────

  async sync(
    accessToken: string,
    config: Record<string, unknown>,
    cursor: SyncCursor | null,
  ): Promise<SyncResult> {
    const syncCursor = this.parseSyncCursor(cursor);
    const teamId = config['teamId'];

    if (typeof teamId !== 'string') {
      throw new Error('Figma sync requires teamId in config');
    }

    const items: SyncedItem[] = [];
    let latestTimestamp = syncCursor.lastSyncTimestamp;

    // Get team projects
    await this.throttle();
    const projects = await this.fetchTeamProjects(accessToken, teamId);

    for (const project of projects) {
      await this.throttle();
      const files = await this.fetchProjectFiles(accessToken, String(project.id));

      for (const file of files) {
        // Skip files not modified since last sync
        const fileModifiedTime = new Date(file.last_modified).getTime();
        if (syncCursor.lastSyncTimestamp > 0 && fileModifiedTime <= syncCursor.lastSyncTimestamp) {
          continue;
        }

        await this.throttle();
        const fileContent = await this.fetchFileContent(accessToken, file.key);
        if (!fileContent) continue;

        await this.throttle();
        const comments = await this.fetchFileComments(accessToken, file.key);

        const contentParts = this.buildFileContent(fileContent, comments);

        items.push({
          externalId: file.key,
          title: file.name,
          content: contentParts.join('\n'),
          sourceUrl: `https://www.figma.com/file/${file.key}`,
          metadata: {
            projectId: project.id,
            projectName: project.name,
            lastModified: file.last_modified,
          },
        });

        if (fileModifiedTime > latestTimestamp) {
          latestTimestamp = fileModifiedTime;
        }
      }
    }

    const nextCursor: FigmaSyncCursor = {
      lastSyncTimestamp: latestTimestamp || Date.now(),
    };

    return {
      items,
      deletedExternalIds: [],
      cursor: nextCursor,
      hasMore: false, // We fetch everything in one pass
    };
  }

  // ── Private helpers ────────────────────────────────────────────────

  private async fetchTeamProjects(
    accessToken: string,
    teamId: string,
  ): Promise<FigmaProject[]> {
    const response = await fetch(`${FIGMA_API_URL}/v1/teams/${teamId}/projects`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      this.logger.warn(`Failed to fetch team projects: ${response.status}`);
      return [];
    }

    const data: FigmaTeamProjectsResponse = await response.json();
    return data.projects;
  }

  private async fetchProjectFiles(
    accessToken: string,
    projectId: string,
  ): Promise<FigmaProjectFile[]> {
    const response = await fetch(`${FIGMA_API_URL}/v1/projects/${projectId}/files`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      this.logger.warn(`Failed to fetch project files: ${response.status}`);
      return [];
    }

    const data: FigmaProjectFilesResponse = await response.json();
    return data.files;
  }

  private async fetchFileContent(
    accessToken: string,
    fileKey: string,
  ): Promise<FigmaFileResponse | null> {
    const response = await fetch(`${FIGMA_API_URL}/v1/files/${fileKey}?depth=2`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      this.logger.warn(`Failed to fetch file ${fileKey}: ${response.status}`);
      return null;
    }

    const data: FigmaFileResponse = await response.json();
    return data;
  }

  private async fetchFileComments(
    accessToken: string,
    fileKey: string,
  ): Promise<FigmaComment[]> {
    const response = await fetch(`${FIGMA_API_URL}/v1/files/${fileKey}/comments`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      this.logger.warn(`Failed to fetch comments for file ${fileKey}: ${response.status}`);
      return [];
    }

    const data: FigmaCommentsResponse = await response.json();
    return data.comments;
  }

  private buildFileContent(
    file: FigmaFileResponse,
    comments: FigmaComment[],
  ): string[] {
    const parts: string[] = [file.name, ''];

    // Pages
    const pages = file.document.children;
    if (pages.length > 0) {
      parts.push('Pages:');
      for (const page of pages) {
        parts.push(`  - ${page.name}`);
        // List top-level frames/components in each page
        if (page.children) {
          for (const child of page.children) {
            parts.push(`    - ${child.name} (${child.type})`);
          }
        }
      }
      parts.push('');
    }

    // Components
    const componentEntries = Object.values(file.components);
    if (componentEntries.length > 0) {
      parts.push('Components:');
      for (const comp of componentEntries) {
        const desc = comp.description ? ` - ${comp.description}` : '';
        parts.push(`  - ${comp.name}${desc}`);
      }
      parts.push('');
    }

    // Comments
    if (comments.length > 0) {
      parts.push('Comments:');
      for (const comment of comments) {
        const resolved = comment.resolved_at ? ' [Resolved]' : '';
        parts.push(`  ${comment.user.handle}: ${comment.message}${resolved}`);
      }
    }

    return parts;
  }

  private parseSyncCursor(cursor: SyncCursor | null): FigmaSyncCursor {
    if (!cursor || typeof cursor !== 'object') {
      return { lastSyncTimestamp: 0 };
    }

    const lastSyncTimestamp = cursor['lastSyncTimestamp'];
    return {
      lastSyncTimestamp: typeof lastSyncTimestamp === 'number' ? lastSyncTimestamp : 0,
    };
  }

  private throttle(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, THROTTLE_DELAY_MS));
  }
}
