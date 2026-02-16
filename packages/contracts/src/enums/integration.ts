import { z } from 'zod';

import { objectValues } from './helpers.js';

export const IntegrationProvider = {
  SLACK: 'SLACK',
  LINEAR: 'LINEAR',
} as const;
export type IntegrationProvider = (typeof IntegrationProvider)[keyof typeof IntegrationProvider];

export const ConnectionStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR',
  DISCONNECTED: 'DISCONNECTED',
} as const;
export type ConnectionStatus = (typeof ConnectionStatus)[keyof typeof ConnectionStatus];

export const SyncStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type SyncStatus = (typeof SyncStatus)[keyof typeof SyncStatus];

export const SyncTrigger = {
  MANUAL: 'MANUAL',
  SCHEDULED: 'SCHEDULED',
  WEBHOOK: 'WEBHOOK',
} as const;
export type SyncTrigger = (typeof SyncTrigger)[keyof typeof SyncTrigger];

export const integrationProviderEnum = z.enum(objectValues(IntegrationProvider));
export const connectionStatusEnum = z.enum(objectValues(ConnectionStatus));
export const syncStatusEnum = z.enum(objectValues(SyncStatus));
export const syncTriggerEnum = z.enum(objectValues(SyncTrigger));
