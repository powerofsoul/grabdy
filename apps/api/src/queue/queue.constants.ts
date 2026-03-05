export const QUEUE_NAMES = [
  'data-source-cleanup',
  'email',
  'notification',
  'ai-usage',
  'file-ingestion',
  'contract-analysis',
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];
