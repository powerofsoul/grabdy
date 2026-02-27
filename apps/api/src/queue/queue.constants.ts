export const QUEUE_NAMES = [
  'ds-pdf',
  'ds-docx',
  'ds-csv',
  'ds-xlsx',
  'ds-text',
  'ds-image',
  'ds-messages',
  'data-source-cleanup',
  'email',
  'notification',
  'ai-usage',
  'integration-discover',
  'integration-process-item',
  'integration-cleanup',
  'integration-scheduled-sync',
  'slack-bot',
  'slack-process-channel',
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];
