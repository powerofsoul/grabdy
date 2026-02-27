import type { WebhookEvent } from '../../../../integrations/connector.interface';
import { notionWebhookPayloadSchema } from '../types';

export function extractPageEvent(body: unknown): WebhookEvent | null {
  const parsed = notionWebhookPayloadSchema.safeParse(body);
  if (!parsed.success) return null;

  const payload = parsed.data;
  const entityId = payload.entity?.id;
  if (!entityId) return null;

  // Map Notion event types to our webhook actions
  const notionEventType = payload.type;
  if (
    notionEventType === 'page.content_updated' ||
    notionEventType === 'page.created' ||
    notionEventType === 'page.properties_updated' ||
    notionEventType === 'page.moved' ||
    notionEventType === 'page.locked' ||
    notionEventType === 'page.unlocked' ||
    notionEventType === 'data_source.schema_updated' ||
    notionEventType === 'database.schema_updated'
  ) {
    return { action: 'updated', externalId: entityId, eventType: 'page' };
  }

  if (notionEventType === 'page.deleted' || notionEventType === 'page.undeleted') {
    return {
      action: notionEventType === 'page.deleted' ? 'deleted' : 'updated',
      externalId: entityId,
      eventType: 'page',
    };
  }

  // Comment events trigger re-sync of the parent page
  if (notionEventType === 'comment.created' || notionEventType === 'comment.updated') {
    return { action: 'updated', externalId: entityId, eventType: 'page' };
  }

  return null;
}
