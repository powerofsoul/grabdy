import type { ConnectionStatus } from '@grabdy/contracts';

export const STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string }> = {
  ACTIVE: { label: 'Connected', color: 'success.main' },
  ERROR: { label: 'Error', color: 'error.main' },
  PAUSED: { label: 'Paused', color: 'warning.main' },
  DISCONNECTED: { label: 'Disconnected', color: 'text.disabled' },
};
