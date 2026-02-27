export const QUEUE_NAMES = ['data-source-cleanup', 'email', 'notification', 'ai-usage'] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];
