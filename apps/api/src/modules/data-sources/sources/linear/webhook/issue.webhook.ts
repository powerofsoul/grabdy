import type { WebhookEvent } from '../../../../integrations/connector.interface';
import { linearWebhookBodySchema } from '../types';

export function extractIssueEvent(body: unknown): WebhookEvent | null {
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

  return { action, externalId, eventType: 'issue' };
}
