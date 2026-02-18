import { z } from 'zod';

import { objectValues } from './helpers.js';

export const IntegrationProvider = {
  SLACK: 'SLACK',
  LINEAR: 'LINEAR',
  GITHUB: 'GITHUB',
  NOTION: 'NOTION',
} as const;
export type IntegrationProvider = (typeof IntegrationProvider)[keyof typeof IntegrationProvider];

export const ConnectionStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR',
  DISCONNECTED: 'DISCONNECTED',
} as const;
export type ConnectionStatus = (typeof ConnectionStatus)[keyof typeof ConnectionStatus];

export const SyncTrigger = {
  INITIAL: 'INITIAL',
  WEBHOOK: 'WEBHOOK',
  SCHEDULED: 'SCHEDULED',
  MANUAL: 'MANUAL',
} as const;
export type SyncTrigger = (typeof SyncTrigger)[keyof typeof SyncTrigger];

export const integrationProviderEnum = z.enum(objectValues(IntegrationProvider));
export const connectionStatusEnum = z.enum(objectValues(ConnectionStatus));
export const syncTriggerEnum = z.enum(objectValues(SyncTrigger));
