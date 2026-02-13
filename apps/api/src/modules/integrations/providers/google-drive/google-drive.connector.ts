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

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_API = 'https://www.googleapis.com/drive/v3';

const EXPORTABLE_MIME_TYPES: Record<string, string> = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain',
};

// --- Google API response interfaces ---

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GoogleDriveUser {
  emailAddress?: string;
  displayName?: string;
}

interface GoogleAboutResponse {
  user?: GoogleDriveUser;
  error?: { message: string; code: number };
}

interface GoogleDriveFile {
  id?: string;
  name?: string;
  mimeType?: string;
  modifiedTime?: string;
  webViewLink?: string;
}

interface GoogleFilesListResponse {
  files?: GoogleDriveFile[];
  nextPageToken?: string;
  error?: { message: string; code: number };
}

interface GoogleStartPageTokenResponse {
  startPageToken?: string;
  error?: { message: string; code: number };
}

interface GoogleChangeItem {
  file?: GoogleDriveFile;
  removed?: boolean;
  fileId?: string;
}

interface GoogleChangesListResponse {
  changes?: GoogleChangeItem[];
  newStartPageToken?: string;
  nextPageToken?: string;
  error?: { message: string; code: number };
}

@Injectable()
export class GoogleDriveConnector extends IntegrationConnector {
  readonly provider = IntegrationProvider.GOOGLE_DRIVE;
  readonly rateLimits: RateLimitConfig = {
    maxRequestsPerMinute: 12000,
    maxRequestsPerHour: 720000,
  };
  readonly supportsWebhooks = false;

  private readonly logger = new Logger(GoogleDriveConnector.name);

  constructor(
    @InjectEnv('googleClientId') private readonly clientId: string,
    @InjectEnv('googleClientSecret') private readonly clientSecret: string,
  ) {
    super();
  }

  getAuthUrl(_orgId: string, state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
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

    const data: GoogleTokenResponse = await response.json();

    if (data.error || !data.access_token) {
      throw new Error(
        `Google OAuth error: ${data.error_description ?? data.error ?? 'Unknown error'}`,
      );
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      scopes: data.scope ? data.scope.split(' ') : ['https://www.googleapis.com/auth/drive.readonly'],
    };
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    const data: GoogleTokenResponse = await response.json();

    if (data.error || !data.access_token) {
      throw new Error(
        `Google token refresh error: ${data.error_description ?? data.error ?? 'Unknown error'}`,
      );
    }

    return {
      accessToken: data.access_token,
      // Google does not return a new refresh token on refresh
      refreshToken: refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
      scopes: data.scope ? data.scope.split(' ') : ['https://www.googleapis.com/auth/drive.readonly'],
    };
  }

  async getAccountInfo(accessToken: string): Promise<AccountInfo> {
    const response = await fetch(`${GOOGLE_DRIVE_API}/about?fields=user`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const result: GoogleAboutResponse = await response.json();

    if (result.error) {
      throw new Error(`Google Drive API error: ${result.error.message}`);
    }

    if (!result.user?.emailAddress || !result.user.displayName) {
      throw new Error('Failed to fetch Google Drive account info: missing user data');
    }

    return {
      id: result.user.emailAddress,
      name: result.user.displayName,
    };
  }

  async registerWebhook(
    _accessToken: string,
    _config: Record<string, unknown>,
  ): Promise<WebhookInfo | null> {
    // Webhook support skipped for now - using polling instead.
    // Google Drive watch channels expire every 7 days and require re-registration.
    return null;
  }

  async deregisterWebhook(_accessToken: string, _webhookId: string): Promise<void> {
    // No-op: webhooks not implemented
  }

  parseWebhook(
    _headers: Record<string, string>,
    _body: unknown,
    _secret: string | null,
  ): WebhookEvent | null {
    // No-op: webhooks not implemented
    return null;
  }

  async sync(
    accessToken: string,
    _config: Record<string, unknown>,
    cursor: SyncCursor | null,
  ): Promise<SyncResult> {
    const isInitialSync = cursor === null || cursor['isInitialSync'] === true;

    if (isInitialSync) {
      const filesNextPageToken =
        cursor !== null && typeof cursor['filesNextPageToken'] === 'string'
          ? cursor['filesNextPageToken']
          : null;
      // Carry forward the changePageToken from a previous pagination page
      const existingChangePageToken =
        cursor !== null && typeof cursor['changePageToken'] === 'string'
          ? cursor['changePageToken']
          : null;
      return this.syncInitial(accessToken, filesNextPageToken, existingChangePageToken);
    }

    const changePageToken =
      typeof cursor['changePageToken'] === 'string' ? cursor['changePageToken'] : null;
    if (!changePageToken) {
      // No change token — fall back to full initial sync
      return this.syncInitial(accessToken, null);
    }
    return this.syncIncremental(accessToken, changePageToken);
  }

  private async syncInitial(
    accessToken: string,
    filesNextPageToken: string | null,
    existingChangePageToken: string | null = null,
  ): Promise<SyncResult> {
    // On first call, get the start page token for future incremental syncs
    // On subsequent calls (pagination), use the token from the first page
    let startPageToken: string | null = existingChangePageToken;
    if (!filesNextPageToken && !startPageToken) {
      startPageToken = await this.fetchStartPageToken(accessToken);
    }

    // List files, optionally continuing from a page token
    const filesResponse = await this.fetchFiles(accessToken, filesNextPageToken);
    const files = filesResponse.files ?? [];

    const items: SyncedItem[] = [];

    for (const file of files) {
      if (!file.id || !file.name || !file.mimeType) {
        continue;
      }

      const exportMimeType = EXPORTABLE_MIME_TYPES[file.mimeType];
      if (!exportMimeType) {
        // Skip non-exportable files (PDFs, DOCX, etc.)
        continue;
      }

      const content = await this.exportFileContent(accessToken, file.id, exportMimeType);
      if (content === null) {
        this.logger.warn(`Failed to export file ${file.id} (${file.name}), skipping`);
        continue;
      }

      items.push({
        externalId: file.id,
        title: file.name,
        content,
        sourceUrl: file.webViewLink ?? null,
        metadata: {
          mimeType: file.mimeType,
          modifiedTime: file.modifiedTime ?? null,
        },
      });
    }

    const nextPageToken = filesResponse.nextPageToken ?? null;
    const hasMore = nextPageToken !== null;

    if (hasMore) {
      // More files to paginate — stay in initial sync mode
      return {
        items,
        deletedExternalIds: [],
        cursor: {
          isInitialSync: true,
          filesNextPageToken: nextPageToken,
          // Pass along the startPageToken if we fetched it on the first page
          changePageToken: startPageToken,
        },
        hasMore: true,
      };
    }

    // Initial sync complete — switch to incremental mode using change token
    // startPageToken may be null if this is a continuation page; the processor
    // stores it from the first page in the cursor.
    return {
      items,
      deletedExternalIds: [],
      cursor: {
        isInitialSync: false,
        changePageToken: startPageToken,
      },
      hasMore: false,
    };
  }

  private async syncIncremental(
    accessToken: string,
    pageToken: string,
  ): Promise<SyncResult> {
    const response = await fetch(
      `${GOOGLE_DRIVE_API}/changes?pageToken=${encodeURIComponent(pageToken)}&fields=changes(file(id,name,mimeType,modifiedTime,webViewLink),removed,fileId),newStartPageToken,nextPageToken&pageSize=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    const data: GoogleChangesListResponse = await response.json();

    if (data.error) {
      throw new Error(`Google Drive Changes API error: ${data.error.message}`);
    }

    const changes = data.changes ?? [];
    const items: SyncedItem[] = [];
    const deletedExternalIds: string[] = [];

    for (const change of changes) {
      if (change.removed) {
        const removedId = change.fileId ?? change.file?.id;
        if (removedId) {
          deletedExternalIds.push(removedId);
        }
        continue;
      }

      const file = change.file;
      if (!file?.id || !file.name || !file.mimeType) {
        continue;
      }

      const exportMimeType = EXPORTABLE_MIME_TYPES[file.mimeType];
      if (!exportMimeType) {
        continue;
      }

      const content = await this.exportFileContent(accessToken, file.id, exportMimeType);
      if (content === null) {
        this.logger.warn(`Failed to export changed file ${file.id} (${file.name}), skipping`);
        continue;
      }

      items.push({
        externalId: file.id,
        title: file.name,
        content,
        sourceUrl: file.webViewLink ?? null,
        metadata: {
          mimeType: file.mimeType,
          modifiedTime: file.modifiedTime ?? null,
        },
      });
    }

    const hasMore = data.nextPageToken !== null && data.nextPageToken !== undefined;
    const nextChangeToken = data.newStartPageToken ?? data.nextPageToken ?? pageToken;

    return {
      items,
      deletedExternalIds,
      cursor: {
        isInitialSync: false,
        changePageToken: nextChangeToken,
      },
      hasMore,
    };
  }

  private async fetchStartPageToken(accessToken: string): Promise<string> {
    const response = await fetch(`${GOOGLE_DRIVE_API}/changes/startPageToken`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data: GoogleStartPageTokenResponse = await response.json();

    if (data.error) {
      throw new Error(`Google Drive startPageToken error: ${data.error.message}`);
    }

    if (!data.startPageToken) {
      throw new Error('Google Drive: no startPageToken in response');
    }

    return data.startPageToken;
  }

  private async fetchFiles(accessToken: string, pageToken?: string | null): Promise<GoogleFilesListResponse> {
    const params = new URLSearchParams({
      q: 'trashed=false',
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink),nextPageToken',
      pageSize: '100',
      orderBy: 'modifiedTime desc',
    });
    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const response = await fetch(`${GOOGLE_DRIVE_API}/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data: GoogleFilesListResponse = await response.json();

    if (data.error) {
      throw new Error(`Google Drive Files API error: ${data.error.message}`);
    }

    return data;
  }

  private async exportFileContent(
    accessToken: string,
    fileId: string,
    exportMimeType: string,
  ): Promise<string | null> {
    try {
      const response = await fetch(
        `${GOOGLE_DRIVE_API}/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent(exportMimeType)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!response.ok) {
        this.logger.warn(
          `Export failed for file ${fileId}: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      return await response.text();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Export error for file ${fileId}: ${message}`);
      return null;
    }
  }
}
