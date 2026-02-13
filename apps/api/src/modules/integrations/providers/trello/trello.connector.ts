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

const TRELLO_API_BASE = 'https://api.trello.com/1';

// --- Trello API response interfaces ---

interface TrelloMember {
  id: string;
  fullName: string;
  username: string;
}

interface TrelloBoard {
  id: string;
  name: string;
  url: string;
}

interface TrelloList {
  id: string;
  name: string;
}

interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  idList: string;
  url: string;
  dateLastActivity: string;
}

interface TrelloActionMemberCreator {
  fullName: string;
}

interface TrelloActionData {
  text: string;
}

interface TrelloAction {
  id: string;
  type: string;
  date: string;
  memberCreator?: TrelloActionMemberCreator;
  data?: TrelloActionData;
}

@Injectable()
export class TrelloConnector extends IntegrationConnector {
  readonly provider = IntegrationProvider.TRELLO;
  readonly rateLimits: RateLimitConfig = {
    maxRequestsPerMinute: 300,
    maxRequestsPerHour: 18000,
  };
  readonly supportsWebhooks = true;

  private readonly logger = new Logger(TrelloConnector.name);

  constructor(
    @InjectEnv('trelloApiKey') private readonly apiKey: string,
    @InjectEnv('trelloApiSecret') private readonly apiSecret: string,
  ) {
    super();
  }

  getAuthUrl(_orgId: string, state: string, redirectUri: string): string {
    // Trello uses a redirect-based auth flow with response_type=token
    // The token is appended as a hash fragment, so we use a server-side redirect
    const params = new URLSearchParams({
      expiration: 'never',
      name: 'Grabdy',
      scope: 'read',
      response_type: 'token',
      key: this.apiKey,
      callback_method: 'fragment',
      return_url: redirectUri,
      state,
    });
    return `https://trello.com/1/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string, _redirectUri: string): Promise<OAuthTokens> {
    // For Trello, the "code" from the callback IS the access token
    // (delivered via URL fragment, captured by the frontend and sent to the backend)
    return {
      accessToken: code,
      refreshToken: null,
      expiresAt: null, // Token never expires
      scopes: ['read'],
    };
  }

  async refreshTokens(_refreshToken: string): Promise<OAuthTokens> {
    throw new Error('Trello tokens do not expire and cannot be refreshed');
  }

  async getAccountInfo(accessToken: string): Promise<AccountInfo> {
    const params = new URLSearchParams({ key: this.apiKey, token: accessToken });
    const response = await fetch(`${TRELLO_API_BASE}/members/me?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Trello member fetch failed: ${response.status} ${response.statusText}`);
    }

    const data: TrelloMember = await response.json();
    return { id: data.id, name: data.fullName };
  }

  async registerWebhook(
    accessToken: string,
    config: Record<string, unknown>,
  ): Promise<WebhookInfo | null> {
    const callbackURL = typeof config['callbackURL'] === 'string' ? config['callbackURL'] : null;
    const idModel = typeof config['idModel'] === 'string' ? config['idModel'] : null;

    if (!callbackURL || !idModel) {
      return null;
    }

    const params = new URLSearchParams({ key: this.apiKey, token: accessToken });
    const response = await fetch(`${TRELLO_API_BASE}/webhooks?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callbackURL,
        idModel,
        description: 'Grabdy integration webhook',
      }),
    });

    if (!response.ok) {
      this.logger.warn(`Failed to register Trello webhook: ${response.status}`);
      return null;
    }

    const webhook: unknown = await response.json();
    if (!isTrelloWebhookResponse(webhook)) {
      return null;
    }

    return { webhookId: webhook.id, secret: null };
  }

  async deregisterWebhook(accessToken: string, webhookId: string): Promise<void> {
    const params = new URLSearchParams({ key: this.apiKey, token: accessToken });
    await fetch(`${TRELLO_API_BASE}/webhooks/${webhookId}?${params.toString()}`, {
      method: 'DELETE',
    });
  }

  parseWebhook(
    _headers: Record<string, string>,
    body: unknown,
    _secret: string | null,
  ): WebhookEvent | null {
    if (!body || typeof body !== 'object') return null;

    const payload = body satisfies object;
    const action =
      'action' in payload && typeof payload.action === 'object' && payload.action !== null
        ? payload.action
        : null;

    if (!action) return null;

    const actionType = 'type' in action && typeof action.type === 'string' ? action.type : null;
    const actionData =
      'data' in action && typeof action.data === 'object' && action.data !== null
        ? action.data
        : null;
    const card =
      actionData && 'card' in actionData && typeof actionData.card === 'object' && actionData.card !== null
        ? actionData.card
        : null;

    if (!card || !('id' in card) || typeof card.id !== 'string') return null;

    let eventAction: WebhookEvent['action'];
    if (actionType === 'createCard') eventAction = 'created';
    else if (actionType === 'updateCard') eventAction = 'updated';
    else if (actionType === 'deleteCard') eventAction = 'deleted';
    else return null;

    return { action: eventAction, externalId: card.id };
  }

  async sync(
    accessToken: string,
    _config: Record<string, unknown>,
    cursor: SyncCursor | null,
  ): Promise<SyncResult> {
    const since =
      cursor !== null && typeof cursor['since'] === 'string' ? cursor['since'] : null;

    const authParams = new URLSearchParams({ key: this.apiKey, token: accessToken });

    // Fetch all boards
    const boardsResponse = await fetch(
      `${TRELLO_API_BASE}/members/me/boards?${authParams.toString()}&fields=name,url`,
      { headers: { Accept: 'application/json' } },
    );

    if (!boardsResponse.ok) {
      throw new Error(`Trello boards fetch failed: ${boardsResponse.status}`);
    }

    const boards: TrelloBoard[] = await boardsResponse.json();
    const allItems: SyncedItem[] = [];
    let latestActivity = since ?? '';

    for (const board of boards) {
      // Fetch lists for the board to map list IDs to names
      const listsResponse = await fetch(
        `${TRELLO_API_BASE}/boards/${board.id}/lists?${authParams.toString()}&fields=name`,
        { headers: { Accept: 'application/json' } },
      );

      if (!listsResponse.ok) continue;

      const lists: TrelloList[] = await listsResponse.json();
      const listNameMap = new Map<string, string>();
      for (const list of lists) {
        listNameMap.set(list.id, list.name);
      }

      // Fetch cards for the board
      // Note: Trello cards endpoint doesn't support `since` filtering.
      // We fetch all cards and filter client-side for incremental syncs.
      const cardParams = new URLSearchParams({
        key: this.apiKey,
        token: accessToken,
        fields: 'name,desc,idList,url,dateLastActivity',
      });

      const cardsResponse = await fetch(
        `${TRELLO_API_BASE}/boards/${board.id}/cards?${cardParams.toString()}`,
        { headers: { Accept: 'application/json' } },
      );

      if (!cardsResponse.ok) continue;

      const allCards: TrelloCard[] = await cardsResponse.json();
      // Filter to only cards modified since last sync
      const cards = since
        ? allCards.filter((card) => card.dateLastActivity > since)
        : allCards;

      for (const card of cards) {
        // Fetch comments for this card
        const actionsResponse = await fetch(
          `${TRELLO_API_BASE}/cards/${card.id}/actions?${authParams.toString()}&filter=commentCard`,
          { headers: { Accept: 'application/json' } },
        );

        let comments: TrelloAction[] = [];
        if (actionsResponse.ok) {
          comments = await actionsResponse.json();
        }

        const listName = listNameMap.get(card.idList) ?? 'Unknown';

        const commentText = comments
          .map((c) => {
            const author = c.memberCreator?.fullName ?? 'Unknown';
            const text = c.data?.text ?? '';
            return `${author}: ${text}`;
          })
          .join('\n---\n');

        const contentParts = [card.name, '', `List: ${listName}`];

        if (card.desc) {
          contentParts.push('', card.desc);
        }

        if (commentText) {
          contentParts.push('', 'Comments:', commentText);
        }

        allItems.push({
          externalId: card.id,
          title: card.name,
          content: contentParts.join('\n'),
          sourceUrl: card.url,
          metadata: {
            boardId: board.id,
            boardName: board.name,
            listId: card.idList,
            listName,
          },
        });

        if (card.dateLastActivity > latestActivity) {
          latestActivity = card.dateLastActivity;
        }
      }
    }

    return {
      items: allItems,
      deletedExternalIds: [],
      cursor: { since: latestActivity || null },
      hasMore: false, // Trello doesn't have cursor-based pagination for this flow
    };
  }
}

// --- Type guards ---

interface TrelloWebhookResponse {
  id: string;
}

function isTrelloWebhookResponse(value: unknown): value is TrelloWebhookResponse {
  return typeof value === 'object' && value !== null && 'id' in value && typeof (value satisfies Record<string, unknown>)['id'] === 'string';
}
