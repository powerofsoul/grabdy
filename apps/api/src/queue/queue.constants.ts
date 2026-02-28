export const QUEUE_NAMES = [
  'data-source-cleanup',
  'email',
  'notification',
  'ai-usage',
  'file-ingestion',
  'integration-sync',
  'integration-webhook',
  'integration-cleanup',
  'slack-bot',
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];
