import { CheckCircleIcon, InfoIcon, WarningCircleIcon, WarningIcon } from '@phosphor-icons/react';

export const VARIANT_CONFIG = {
  info: { Icon: InfoIcon, paletteKey: 'info' as const },
  success: { Icon: CheckCircleIcon, paletteKey: 'success' as const },
  warning: { Icon: WarningIcon, paletteKey: 'warning' as const },
  error: { Icon: WarningCircleIcon, paletteKey: 'error' as const },
};
