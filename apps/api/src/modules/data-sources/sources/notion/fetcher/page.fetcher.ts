import { Injectable, Logger } from '@nestjs/common';

import type { Client } from '@notionhq/client';

import type { SyncedItem, WebhookEvent } from '../../../../integrations/connector.interface';
import {
  notionDbTitleSchema,
  notionPageSchema,
  notionPropertiesSchema,
  notionTitlePropertySchema,
} from '../types';
import { blockToText, extractRichText } from '../utils';

@Injectable()
export class NotionPageFetcher {
  private readonly logger = new Logger(NotionPageFetcher.name);

  async fetchItem(client: Client, notionPageId: string): Promise<SyncedItem | null> {
    try {
      const page = await client.pages.retrieve({ page_id: notionPageId });
      return this.buildPageSyncedItem(client, notionPageId, page);
    } catch (err) {
      this.logger.warn(`Could not fetch Notion page ${notionPageId}: ${err}`);
      return null;
    }
  }

  async fetchUpdatedItems(
    client: Client,
    since: string
  ): Promise<{ webhookEvents: WebhookEvent[]; maxEditedTime: string | null }> {
    const webhookEvents: WebhookEvent[] = [];
    let maxEditedTime: string | null = null;
    let startCursor: string | undefined;
    let keepPaging = true;

    do {
      const searchParams: {
        sort: { timestamp: 'last_edited_time'; direction: 'descending' };
        start_cursor?: string;
        page_size: number;
      } = {
        sort: { timestamp: 'last_edited_time', direction: 'descending' },
        page_size: 100,
      };
      if (startCursor) {
        searchParams.start_cursor = startCursor;
      }

      const searchResponse = await client.search(searchParams);

      for (const result of searchResponse.results) {
        if (!('last_edited_time' in result)) continue;

        const editedTime = result.last_edited_time;

        if (editedTime <= since) {
          keepPaging = false;
          break;
        }

        if (!maxEditedTime || editedTime > maxEditedTime) {
          maxEditedTime = editedTime;
        }

        // Queue each page as an individual webhook job
        webhookEvents.push({ action: 'updated', externalId: result.id });
      }

      if (!keepPaging) break;

      if (searchResponse.has_more && searchResponse.next_cursor) {
        startCursor = searchResponse.next_cursor;
      } else {
        keepPaging = false;
      }
    } while (keepPaging);

    return { webhookEvents, maxEditedTime };
  }

  private async buildPageSyncedItem(
    client: Client,
    notionPageId: string,
    pageObj: unknown
  ): Promise<SyncedItem | null> {
    const parsed = notionPageSchema.safeParse(pageObj);
    if (!parsed.success) return null;

    const isDataSource = parsed.data.object === 'database';

    // Extract title
    let title = 'Untitled';
    if (isDataSource) {
      const dbParsed = notionDbTitleSchema.safeParse(pageObj);
      if (dbParsed.success && dbParsed.data.title.length > 0) {
        title = extractRichText(dbParsed.data.title);
      }
    } else {
      const propsParsed = notionPropertiesSchema.safeParse(pageObj);
      if (propsParsed.success) {
        title = this.extractPageTitle(propsParsed.data.properties);
      }
    }

    // Build page URL
    const urlId = notionPageId.replace(/-/g, '');
    const sourceUrl = `https://www.notion.so/${urlId}`;

    // Fetch block content
    let content: string;
    try {
      content = await this.fetchBlockContent(client, notionPageId);
    } catch (err) {
      this.logger.warn(`Failed to fetch blocks for page ${notionPageId}: ${err}`);
      content = '';
    }

    const fullContent = title + '\n\n' + content;

    return {
      externalId: notionPageId,
      title,
      content: fullContent,
      messages: [
        {
          content: fullContent,
          metadata: { type: 'NOTION', notionPageId, notionBlockId: null },
          sourceUrl,
        },
      ],
      sourceUrl,
      metadata: {
        notionPageId,
        isDataSource,
      },
    };
  }

  private async fetchBlockContent(
    client: Client,
    notionBlockId: string,
    depth = 0
  ): Promise<string> {
    if (depth > 3) return '';

    const lines: string[] = [];
    let cursor: string | undefined;

    do {
      const response = await client.blocks.children.list({
        block_id: notionBlockId,
        start_cursor: cursor,
        page_size: 100,
      });

      for (const block of response.results) {
        const text = blockToText(block);
        if (text) {
          lines.push(text);
        }

        if ('has_children' in block && block.has_children) {
          const childContent = await this.fetchBlockContent(client, block.id, depth + 1);
          if (childContent) {
            lines.push(childContent);
          }
        }
      }

      cursor = response.has_more && response.next_cursor ? response.next_cursor : undefined;
    } while (cursor);

    return lines.join('\n');
  }

  private extractPageTitle(properties: unknown): string {
    if (typeof properties !== 'object' || properties === null) return 'Untitled';

    for (const value of Object.values(properties)) {
      const parsed = notionTitlePropertySchema.safeParse(value);
      if (parsed.success && parsed.data.title.length > 0) {
        return extractRichText(parsed.data.title);
      }
    }
    return 'Untitled';
  }
}
